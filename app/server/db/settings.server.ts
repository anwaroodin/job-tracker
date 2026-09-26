import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, parseSettings, type Settings } from "~/lib/settings";
import type { Db } from "./client.server";
import { userSettings, type UserSettings } from "./schema";

export function settingsRowFor(db: Db, userId: string) {
  return db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
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
