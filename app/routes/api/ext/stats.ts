import type { Route } from "./+types/stats";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { applicationStats } from "~/server/db/applications.server";
import { extUser, guarded, json, preflight } from "~/server/ext-api.server";

/** GET /api/ext/stats: checks the session and gives the popup its tracked count. */
export const loader = (args: Route.LoaderArgs) => guarded(args.request, () => stats(args));

async function stats({ request, context }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });
  return json(request, await applicationStats(getDb(env.DB), user.id));
}
