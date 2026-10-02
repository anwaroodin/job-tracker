import type { Route } from "./+types/application";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication, updateApplication } from "~/server/db/queries/applications.server";
import { setByHand } from "~/server/services/status/manual";
import { clearBookmarkOnApply } from "~/server/services/status/rules";
import type { NewApplication } from "~/types/application";
import { extUser, guarded, json, preflight, readJsonBody } from "~/server/extension/http.server";
import { applicationStatus, jobDetails } from "~/server/extension/input.server";

/**
 * PATCH /api/ext/applications/:id with { status?, starred?, ...job details }:
 * status and bookmark changes from the extension's action bar, and details
 * the page rendered after the job was saved.
 */
export const action = (args: Route.ActionArgs) => guarded(args.request, () => update(args));

async function update({ request, params, context }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  if (request.method !== "PATCH") return json(request, { error: "method_not_allowed" }, { status: 405 });

  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });

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
  await updateApplication(db, user.id, params.id, clearBookmarkOnApply(current.status, patch));
  return json(request, { success: true, application: await getApplication(db, user.id, params.id) });
}

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  return json(request, { error: "method_not_allowed" }, { status: 405 });
}
