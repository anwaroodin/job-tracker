import { data } from "react-router";
import type { Route } from "./+types/status";
import { getSession } from "~/server/auth.server";
import { envContext, execContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getGmailStatus, syncGmailInBackground } from "~/server/gmail/sync.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) return data({ error: "not_authenticated" }, { status: 401 });

  const status = await getGmailStatus(getDb(env.DB), session.user.id);
  const started = syncGmailInBackground(env, context.get(execContext), session.user.id, status);
  return started ? { ...status, syncing: true, stage: "checking" as const, stageCount: null } : status;
}
