import type { Route } from "./+types/applications";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import {
  clearBookmarkOnApply,
  createApplication,
  findRecentDuplicate,
  getApplication,
  updateApplication,
} from "~/server/db/applications.server";
import type { NewApplication } from "~/server/db/schema";
import { extUser, guarded, json, preflight, readJsonBody } from "~/server/ext-api.server";
import { applicationStatus, cleanUrl, jobDetails, text } from "~/server/ext-input.server";

/**
 * POST /api/ext/applications: tracks a posting. Idempotent per posting: when
 * the same URL, or the same company and role, was tracked in the last 30
 * days, the existing application is updated and returned instead.
 */
export const action = (args: Route.ActionArgs) => guarded(args.request, () => track(args));

async function track({ request, context }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  if (request.method !== "POST") return json(request, { error: "method_not_allowed" }, { status: 405 });

  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const company = text(body.company, 200);
  const role = text(body.role, 200);
  if (!company || !role) return json(request, { error: "company and role are required" }, { status: 400 });

  const url = cleanUrl(body.url);
  const status = applicationStatus(body.status);
  const details = jobDetails(body);
  const db = getDb(env.DB);

  const existing = await findRecentDuplicate(db, user.id, { url, company, role });
  if (existing) {
    // Fill in details that loaded after the first save (LinkedIn renders
    // descriptions lazily), but keep the company and role already stored.
    const { company: _company, role: _role, ...rest } = details;
    const patch: Partial<NewApplication> = rest;
    // Applying to a saved posting turns the bookmark into the application.
    if (existing.status === "saved" && status && status !== "saved") {
      const now = new Date().toISOString();
      Object.assign(patch, { status, manualStatusAt: now, appliedAt: now });
    }
    if (typeof body.starred === "boolean") patch.starred = body.starred;
    clearBookmarkOnApply(existing.status, patch);
    if (Object.keys(patch).length) await updateApplication(db, user.id, existing.id, patch);
    const application = await getApplication(db, user.id, existing.id);
    return json(request, { success: true, duplicate: true, application });
  }

  const application = await createApplication(db, {
    ...details,
    id: crypto.randomUUID(),
    userId: user.id,
    company,
    role,
    url,
    cvType: details.cvType ?? "software",
    category: details.category ?? null,
    status: status || "applied",
    // A status the user picked counts as set by hand, so Gmail sync won't override it.
    manualStatusAt: status ? new Date().toISOString() : null,
    starred: body.starred === true,
    autoFilled: body.auto_filled !== false,
  });
  return json(request, { success: true, duplicate: false, application }, { status: 201 });
}

/**
 * GET /api/ext/applications?url=&company=&role=: the application tracked for
 * a posting, matched on URL or company + role, or { application: null }.
 */
export const loader = (args: Route.LoaderArgs) => guarded(args.request, () => lookup(args));

async function lookup({ request, context }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const match = {
    url: cleanUrl(params.get("url")),
    company: text(params.get("company"), 200),
    role: text(params.get("role"), 200),
  };
  if (!match.url && !(match.company && match.role)) return json(request, { application: null });
  // A year, not 30 days: saved postings and old applications should still show on their listing.
  const application = await findRecentDuplicate(getDb(env.DB), user.id, match, 365);
  return json(request, { application });
}
