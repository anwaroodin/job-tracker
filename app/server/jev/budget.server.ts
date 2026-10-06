import type { Db } from "../db/client.server";
import { settingsRowFor, withDefaults } from "../db/queries/settings.server";
import { dollars, insertUsage, monthStart, tokensSince } from "../db/queries/usage.server";

export interface JevSpend {
  model: string;
  inputTokens: number;
}

export async function overJevBudget(db: Db, userId: string) {
  const [[settingsRow], [spent]] = await db.batch([settingsRowFor(db, userId), tokensSince(db, userId, monthStart())]);
  const { monthlyBudget } = withDefaults(settingsRow);
  return monthlyBudget !== null && dollars(Number(spent?.tokens ?? 0)) >= monthlyBudget;
}

export function recordJevSpend(db: Db, userId: string, source: string, spend: JevSpend[]) {
  if (!spend.length) return;
  return insertUsage(db, {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    source,
    emails: 0,
    inputTokens: spend.reduce((sum, s) => sum + s.inputTokens, 0),
    model: spend[0].model,
  });
}
