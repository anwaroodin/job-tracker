import { goalNotice, goalProgress, STALE_SAVED_DAYS } from "~/lib/goal";
import { OFFER_STATUSES, PREP_STATUSES } from "~/lib/status";
import type { Analytics } from "~/types/analytics";
import type { Db } from "../../db/client.server";
import { insertActivityOnce, statusChangesBetween } from "../../db/queries/activity.server";
import { savedJobs } from "../../db/queries/applications.server";
import { weeklyGoalFor } from "../../db/queries/settings.server";
import { analyticsFor } from "./analytics.server";

const DAY_MS = 86_400_000;
const REVIEW_DAYS = 3;
const STALE_SHOWN = 5;

export async function ensureGoalNotice(db: Db, userId: string) {
  try {
    const [analytics, goal] = await Promise.all([analyticsFor(db, userId), weeklyGoalFor(db, userId)]);
    const notice = goalNotice(analytics.weekly, goal);
    if (!notice) return;
    const { key, ...detail } = notice;
    await insertActivityOnce(db, userId, `goal-${userId}-${key}`, { kind: "goal", detail });
  } catch (error) {
    console.error("goal notice failed", error);
  }
}

export async function weeklyReview(db: Db, userId: string, analytics: Analytics, goal: number | null, now = new Date()) {
  const thisWeek = analytics.weekly.at(-1);
  const lastWeek = analytics.weekly.at(-2);
  if (!thisWeek || !lastWeek || (now.getUTCDay() + 6) % 7 >= REVIEW_DAYS) return null;

  const [changes, saved] = await Promise.all([statusChangesBetween(db, userId, lastWeek.weekStart, thisWeek.weekStart), savedJobs(db, userId)]);
  const moves = changes.map((row) => ({ applicationId: row.applicationId, to: (JSON.parse(row.detail ?? "{}") as { to?: string }).to ?? "" }));
  const apps = (match: (to: string) => boolean) => new Set(moves.filter((m) => match(m.to)).map((m) => m.applicationId)).size;
  const staleBefore = new Date(now.getTime() - STALE_SAVED_DAYS * DAY_MS).toISOString();
  const stale = saved.filter((job) => job.savedAt < staleBefore);

  return {
    applied: lastWeek.count,
    goal,
    hit: goal !== null && lastWeek.count >= goal,
    streak: goal ? goalProgress(analytics.weekly.slice(0, -1), goal, new Date(Date.parse(thisWeek.weekStart) - DAY_MS)).streak : 0,
    heardBack: apps((to) => to !== "applied" && to !== "ghosted"),
    interviews: apps((to) => PREP_STATUSES.has(to)),
    offers: apps((to) => OFFER_STATUSES.has(to)),
    rejections: apps((to) => to === "rejected"),
    stale: stale.slice(0, STALE_SHOWN),
    staleCount: stale.length,
  };
}
