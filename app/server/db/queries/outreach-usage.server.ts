import { gte, sql } from "drizzle-orm";
import type { Db } from "../client.server";
import { outreachUsage } from "../schema";

export interface OutreachCall {
  provider: string;
  action: string;
  found: number;
  costUsd: number;
}

export function recordOutreachUsage(db: Db, userId: string, calls: OutreachCall[]) {
  const createdAt = new Date().toISOString();
  return db.insert(outreachUsage).values(calls.map((call) => ({ id: crypto.randomUUID(), userId, createdAt, ...call })));
}

export function outreachSpendSince(db: Db, since: string) {
  return db
    .select({
      provider: outreachUsage.provider,
      requests: sql<number>`count(*)`,
      found: sql<number>`coalesce(sum(${outreachUsage.found}), 0)`,
      cost: sql<number>`coalesce(sum(${outreachUsage.costUsd}), 0)`,
    })
    .from(outreachUsage)
    .where(gte(outreachUsage.createdAt, since))
    .groupBy(outreachUsage.provider);
}
