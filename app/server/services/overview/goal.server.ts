import { goalNotice } from "~/lib/goal";
import type { Db } from "../../db/client.server";
import { insertActivityOnce } from "../../db/queries/activity.server";
import { weeklyGoalFor } from "../../db/queries/settings.server";
import { analyticsFor } from "./analytics.server";

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
