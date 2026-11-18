import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "../client.server";
import { emailPattern } from "../schema";

export interface LearnedPattern {
  domain: string;
  pattern: string;
}

export function recordPatterns(db: Db, learned: LearnedPattern[]) {
  const updatedAt = new Date().toISOString();
  return db
    .insert(emailPattern)
    .values(learned.map((row) => ({ ...row, updatedAt })))
    .onConflictDoUpdate({
      target: [emailPattern.domain, emailPattern.pattern],
      set: { confirmations: sql`${emailPattern.confirmations} + 1`, updatedAt },
    });
}

export function patternsFor(db: Db, domain: string) {
  return db
    .select({ pattern: emailPattern.pattern, confirmations: emailPattern.confirmations })
    .from(emailPattern)
    .where(eq(emailPattern.domain, domain))
    .orderBy(desc(emailPattern.confirmations));
}
