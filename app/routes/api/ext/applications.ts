import type { Route } from "./+types/applications";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { findRecentDuplicate } from "~/server/db/queries/applications.server";
import { trackPosting } from "~/server/services/applications/track.server";
import { extUser, guarded, json, preflight, readJsonBody } from "~/server/extension/http.server";
import { applicationStatus, cleanUrl, jobDetails, text } from "~/server/extension/input.server";

/** POST /api/ext/applications: tracks a posting (see trackPosting). */
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

  const db = getDb(env.DB);
  const { duplicate, application } = await trackPosting(db, user.id, {
    company,
    role,
    url: cleanUrl(body.url),
    status: applicationStatus(body.status),
    details: jobDetails(body),
    starred: typeof body.starred === "boolean" ? body.starred : undefined,
    autoFilled: body.auto_filled !== false,
  });
  return duplicate
    ? json(request, { success: true, duplicate: true, application })
    : json(request, { success: true, duplicate: false, application }, { status: 201 });
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
