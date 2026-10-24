import type { Route } from "./+types/application";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication, updateApplication } from "~/server/db/queries/applications.server";
import { latestTailoredCv } from "~/server/db/queries/tailored-cv.server";
import { setByHand } from "~/server/services/status/manual";
import { clearBookmarkOnApply } from "~/server/services/status/rules";
import { settleSavedJob } from "~/server/services/status/saved.server";
import type { NewApplication } from "~/types/application";
import { extUser, guarded, json, preflight, readJsonBody } from "~/server/extension/http.server";
import { applicationStatus, jobDetails } from "~/server/extension/input.server";

/**
 * PATCH /api/ext/applications/:id with { status?, starred?, ...job details }:
 * status and star changes from the extension's action bar, and details the
 * page rendered after the job was saved.
 * DELETE /api/ext/applications/:id removes a saved job (saved means bookmarked,
 * so this is the bar's un-bookmark). Applications past "saved" are kept.
 */
export const action = (args: Route.ActionArgs) => guarded(args.request, () => update(args));

async function update({ request, params, context }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  if (request.method !== "PATCH" && request.method !== "DELETE") return json(request, { error: "method_not_allowed" }, { status: 405 });

  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });

  if (request.method === "DELETE") {
    const removed = await settleSavedJob(getDb(env.DB), user.id, params.id, "removed");
    return removed ? json(request, { success: true }) : json(request, { error: "not_a_saved_job" }, { status: 404 });
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const patch: Partial<NewApplication> = jobDetails(body);
  if (body.status !== undefined) {
    const status = applicationStatus(body.status);
    if (!status) return json(request, { error: "invalid_status" }, { status: 400 });
    Object.assign(patch, setByHand(status));
  }
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (!Object.keys(patch).length) return json(request, { error: "nothing_to_update" }, { status: 400 });

  const db = getDb(env.DB);
  const current = await getApplication(db, user.id, params.id);
  if (!current) return json(request, { error: "not_found" }, { status: 404 });
  const application = await updateApplication(db, user.id, params.id, clearBookmarkOnApply(current.status, patch));
  return json(request, { success: true, application });
}

export const loader = (args: Route.LoaderArgs) => guarded(args.request, () => tailored(args));

async function tailored({ request, params, context }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });
  const latest = await latestTailoredCv(getDb(env.DB), user.id, params.id);
  if (!latest) return json(request, { summary: null, coverLetter: null });
  const { summary, coverLetter } = latest.cv;
  return json(request, { summary, coverLetter: [coverLetter.greeting, ...coverLetter.paragraphs, coverLetter.signOff].filter(Boolean).join("\n\n") });
}
