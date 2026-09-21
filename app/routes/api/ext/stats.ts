import type { Route } from "./+types/stats";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { applicationStats } from "~/server/db/applications.server";
import { extUser, json, preflight } from "~/server/ext-api.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });
  const stats = await applicationStats(getDb(env.DB), user.id);
  return json(request, stats);
}
