import { data } from "react-router";
import type { Route } from "./+types/activity";
import { getSession } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { markActivitySeen, recentActivity } from "~/server/db/activity.server";
import { getDb } from "~/server/db/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) throw data({ error: "not_authenticated" }, { status: 401 });
  return { items: await recentActivity(getDb(env.DB), session.user.id) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) throw data({ error: "not_authenticated" }, { status: 401 });
  await markActivitySeen(getDb(env.DB), session.user.id);
  return { ok: true };
}
