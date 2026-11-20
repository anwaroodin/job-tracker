import { eq, sql } from "drizzle-orm";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "~/lib/settings";
import type { Db } from "../client.server";
import { userSettings, type UserSettings } from "../schema";

export function settingsRowFor(db: Db, userId: string) {
  return db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
}

export function minConfidenceFor(userId: string) {
  return sql<number>`coalesce((select ${userSettings.minConfidence} from ${userSettings} where ${userSettings.userId} = ${userId}), ${DEFAULT_SETTINGS.minConfidence})`;
}

export function withDefaults(row: UserSettings | undefined): Settings {
  return row ? parseSettings(row) : DEFAULT_SETTINGS;
}

export async function getSettings(db: Db, userId: string) {
  const [row] = await settingsRowFor(db, userId);
  return withDefaults(row);
}

export async function saveSettings(db: Db, userId: string, settings: Settings) {
  const values = { ...settings, updatedAt: new Date().toISOString() };
  await db
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userSettings.userId, set: values });
}

export async function weeklyGoalFor(db: Db, userId: string) {
  const [row] = await db.select({ goal: userSettings.weeklyGoal }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return row?.goal ?? null;
}

export function setWeeklyGoal(db: Db, userId: string, weeklyGoal: number | null) {
  const updatedAt = new Date().toISOString();
  return db
    .insert(userSettings)
    .values({ userId, weeklyGoal, updatedAt })
    .onConflictDoUpdate({ target: userSettings.userId, set: { weeklyGoal, updatedAt } });
}

export async function isOnboarded(db: Db, userId: string) {
  const [row] = await db
    .select({ at: userSettings.onboardedAt })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return !!row?.at;
}

export async function markOnboarded(db: Db, userId: string) {
  const onboardedAt = new Date().toISOString();
  await db
    .insert(userSettings)
    .values({ userId, onboardedAt })
    .onConflictDoUpdate({ target: userSettings.userId, set: { onboardedAt } });
}
