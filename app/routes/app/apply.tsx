import type { Route } from "./+types/apply";
import { ApplySession } from "~/components/apply/session";
import { goalProgress } from "~/lib/goal";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { appliedSince } from "~/server/db/queries/applications.server";
import { weeklyGoalFor } from "~/server/db/queries/settings.server";
import { addSavedJob } from "~/server/services/applications/add-saved-job.server";
import { applyQueue } from "~/server/services/applications/apply-queue.server";
import { analyticsFor } from "~/server/services/overview/analytics.server";

const RECENT_MS = 86_400_000;

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.get(envContext).DB);
  const user = context.get(userContext);
  const since = new Date(Date.now() - RECENT_MS).toISOString();
  const [queue, goal, analytics, recentlyApplied] = await Promise.all([applyQueue(db, user.id), weeklyGoalFor(db, user.id), analyticsFor(db, user.id), appliedSince(db, user.id, since)]);
  return { ...queue, recentlyApplied, thisWeek: analytics.weekly.at(-1)?.count ?? 0, progress: goal ? goalProgress(analytics.weekly, goal) : null };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const form = await request.formData();
  if (form.get("intent") !== "add-job") return { error: "Unknown action." };
  return addSavedJob(env, getDb(env.DB), context.get(userContext).id, form);
}

export default function Apply({ loaderData }: Route.ComponentProps) {
  return <ApplySession {...loaderData} />;
}
