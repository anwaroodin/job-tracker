import { and, eq, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { GMAIL_SCOPE } from "~/lib/gmail";
import type { SyncStage } from "~/types/gmail";
import type { Db } from "../client.server";
import { account, emailMessage, gmailSync, userSettings } from "../schema";

const isGmailAccount = and(eq(account.providerId, "google"), like(account.scope, `%${GMAIL_SCOPE}%`));

export function gmailStatusRow(db: Db, userId: string) {
  return db
    .select({
      lastRunAt: gmailSync.lastRunAt,
      lastError: gmailSync.lastError,
      hasMore: gmailSync.hasMore,
      stage: gmailSync.stage,
      stageCount: gmailSync.stageCount,
      lastFetched: gmailSync.lastFetched,
      lastLinked: gmailSync.lastLinked,
      autoSync: userSettings.autoSync,
      lastFinishedAt: gmailSync.lastFinishedAt,
    })
    .from(account)
    .leftJoin(gmailSync, eq(gmailSync.userId, account.userId))
    .leftJoin(userSettings, eq(userSettings.userId, account.userId))
    .where(and(eq(account.userId, userId), isGmailAccount))
    .limit(1);
}

export function usersWithAutoSync(db: Db) {
  return db
    .selectDistinct({ userId: account.userId })
    .from(account)
    .leftJoin(userSettings, eq(userSettings.userId, account.userId))
    .where(and(isGmailAccount, or(isNull(userSettings.autoSync), eq(userSettings.autoSync, true))));
}

export function claimRun(db: Db, userId: string, startedAt: string, gapMs: number, autoEveryMs: number | null) {
  const now = Date.parse(startedAt);
  const ranBefore = (ms: number) => sql`${gmailSync.lastRunAt} < ${new Date(now - ms).toISOString()}`;
  const due =
    autoEveryMs === null
      ? ranBefore(gapMs)
      : sql`${ranBefore(autoEveryMs)} or (${gmailSync.hasMore} = 1 and ${ranBefore(gapMs)})`;

  return db
    .insert(gmailSync)
    .values({ userId, lastRunAt: startedAt, stage: "checking" })
    .onConflictDoUpdate({
      target: gmailSync.userId,
      set: { lastRunAt: startedAt, stage: "checking", stageCount: null },
      setWhere: sql`${gmailSync.lastRunAt} is null or (${due})`,
    })
    .returning({ syncedThrough: gmailSync.syncedThrough, classifier: gmailSync.classifier, matchedAt: gmailSync.matchedAt });
}

export function gmailAccountFor(db: Db, userId: string) {
  return db.select({ id: account.id }).from(account).where(and(eq(account.userId, userId), isGmailAccount)).limit(1);
}

export function setStage(db: Db, userId: string, stage: SyncStage, count: number) {
  return updateSyncState(db, userId, { stage, stageCount: count });
}

export function updateSyncState(db: Db, userId: string, values: Partial<typeof gmailSync.$inferInsert>) {
  return db.update(gmailSync).set(values).where(eq(gmailSync.userId, userId));
}

export async function requestReclassify(db: Db, userId: string) {
  await db.batch([
    db.update(gmailSync).set({ classifier: null }).where(eq(gmailSync.userId, userId)),
    // Pruned stubs are judged again too: forgetting what judged them queues them for download.
    db
      .update(emailMessage)
      .set({ prunedClassifier: null })
      .where(and(eq(emailMessage.userId, userId), isNotNull(emailMessage.prunedAt))),
  ]);
}
