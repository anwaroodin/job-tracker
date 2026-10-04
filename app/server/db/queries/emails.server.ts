import { and, asc, desc, eq, gte, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { chunk } from "~/lib/array";
import { APPLICATION_CATEGORIES, NEEDS_REPLY_PROBABILITY, type EmailCategory } from "~/lib/email";
import { CLOSED_STATUSES } from "~/lib/status";
import { cached, invalidate, UNREAD_COUNTS_CACHE } from "../../cache.server";
import { asBatch, MAX_IDS_PER_STATEMENT } from "../batch.server";
import type { Db } from "../client.server";
import { hasUpNextDetails, isStageEmail, isUnreadLink } from "../predicates";
import { markThreadsForRefetch } from "./email-retention.server";
import { updateSyncState } from "./gmail-sync.server";
import { application, emailLink, emailMessage } from "../schema";

// Same reasoning as ANALYTICS_TTL_SECONDS in services/overview/analytics.server.ts:
// every write path already invalidates this explicitly, so the TTL is just a
// cross-colo backstop, not the freshness mechanism.
const UNREAD_COUNTS_TTL_SECONDS = 300;

export function applicationEmailRows(db: Db, userId: string, applicationId: string) {
  return db
    .select({
      id: emailLink.id,
      threadId: emailMessage.threadId,
      viewedAt: emailLink.viewedAt,
      dismissedAt: emailLink.dismissedAt,
      category: emailMessage.category,
      confidence: emailMessage.confidence,
      manualCategoryAt: emailMessage.manualCategoryAt,
      manualKind: emailMessage.manualKind,
      eventAt: emailMessage.eventAt,
      eventText: emailMessage.eventText,
      actionUrl: emailMessage.actionUrl,
      actionText: emailMessage.actionText,
      needsReply: emailMessage.needsReply,
      replyDoneAt: emailMessage.replyDoneAt,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
      receivedAt: emailMessage.receivedAt,
    })
    .from(emailLink)
    .leftJoin(
      emailMessage,
      and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)),
    )
    .where(and(eq(emailLink.userId, userId), eq(emailLink.applicationId, applicationId)));
}

export async function unreadEmailCounts(db: Db, userId: string) {
  return cached(UNREAD_COUNTS_CACHE, userId, UNREAD_COUNTS_TTL_SECONDS, () => computeUnreadEmailCounts(db, userId));
}

async function computeUnreadEmailCounts(db: Db, userId: string) {
  const rows = await db
    .select({
      applicationId: emailLink.applicationId,
      count: sql<number>`count(*)`,
    })
    .from(emailLink)
    .innerJoin(
      emailMessage,
      and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)),
    )
    .where(
      and(
        eq(emailLink.userId, userId),
        isUnreadLink(emailLink),
        ne(emailMessage.category, "deleted"),
      ),
    )
    .groupBy(emailLink.applicationId);
  return Object.fromEntries(rows.map((r) => [r.applicationId, r.count]));
}

export async function markViewed(db: Db, userId: string, ids: string[]) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  const updates = chunk(ids, MAX_IDS_PER_STATEMENT).map((part) =>
    db
      .update(emailLink)
      .set({ viewedAt: now })
      .where(and(eq(emailLink.userId, userId), inArray(emailLink.id, part), isNull(emailLink.viewedAt))),
  );
  await db.batch(asBatch(updates));
  await invalidate(UNREAD_COUNTS_CACHE, userId);
}

export async function setEmailCategory(db: Db, userId: string, emailId: string, category: EmailCategory) {
  await db.batch([
    db
      .update(emailMessage)
      .set({
        category,
        manualCategoryAt: new Date().toISOString(),
        manualKind: sql`case when ${emailMessage.category} = ${category} then 'confirmed' else 'corrected' end`,
        detailsAt: sql`case when ${emailMessage.category} = ${category} then ${emailMessage.detailsAt} else null end`,
      })
      .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, emailId), ne(emailMessage.category, "deleted"))),
    markThreadsForRefetch(db, userId, [emailId]),
    updateSyncState(db, userId, { matchedAt: null }),
  ]);
}

export async function setEmailDismissed(
  db: Db,
  userId: string,
  applicationId: string,
  emailId: string,
  dismissed: boolean,
) {
  await db
    .update(emailLink)
    .set({ dismissedAt: dismissed ? new Date().toISOString() : null })
    .where(and(eq(emailLink.userId, userId), eq(emailLink.applicationId, applicationId), eq(emailLink.id, emailId)));
  await invalidate(UNREAD_COUNTS_CACHE, userId);
}

export async function markReplyDone(db: Db, userId: string, emailId: string) {
  await db
    .update(emailMessage)
    .set({ replyDoneAt: new Date().toISOString() })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, emailId)));
}

export function upNextRows(db: Db, userId: string, today: string, replySince: string) {
  const needsReply = and(
    gte(emailMessage.needsReply, NEEDS_REPLY_PROBABILITY),
    isNull(emailMessage.replyDoneAt),
    gte(emailMessage.receivedAt, replySince),
  );
  return db
    .select({
      emailId: emailMessage.id,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      category: emailMessage.category,
      subject: emailMessage.subject,
      receivedAt: emailMessage.receivedAt,
      eventAt: emailMessage.eventAt,
      replyNeeded: sql<number>`case when ${needsReply} then 1 else 0 end`,
    })
    .from(emailMessage)
    .crossJoin(emailLink)
    .innerJoin(application, and(eq(application.id, emailLink.applicationId), eq(application.userId, emailLink.userId)))
    .where(
      and(
        eq(emailMessage.userId, userId),
        hasUpNextDetails(emailMessage),
        eq(emailLink.userId, emailMessage.userId),
        eq(emailLink.id, emailMessage.id),
        isNull(emailLink.dismissedAt),
        notInArray(application.status, CLOSED_STATUSES),
        or(gte(emailMessage.eventAt, today), needsReply),
      ),
    )
    .orderBy(desc(emailMessage.receivedAt));
}

export function suggestionRows(db: Db, userId: string, minProbability: number, since: string) {
  return db
    .select({
      id: emailMessage.id,
      threadId: emailMessage.threadId,
      category: emailMessage.category,
      company: emailMessage.suggestedCompany,
      role: emailMessage.suggestedRole,
      subject: emailMessage.subject,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
      receivedAt: emailMessage.receivedAt,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        isStageEmail(emailMessage),
        inArray(emailMessage.category, [...APPLICATION_CATEGORIES]),
        gte(emailMessage.isApplication, minProbability),
        isNull(emailMessage.suggestionDismissedAt),
        gte(emailMessage.receivedAt, since),
        sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
      ),
    )
    .orderBy(asc(emailMessage.receivedAt));
}

export async function linkEmailsToApplication(db: Db, userId: string, applicationId: string, emailIds: string[]) {
  const [owned] = await db
    .select({ id: application.id })
    .from(application)
    .where(and(eq(application.id, applicationId), eq(application.userId, userId)))
    .limit(1);
  if (!owned || !emailIds.length) return;
  const found = await db.batch(
    asBatch(
      chunk(emailIds, MAX_IDS_PER_STATEMENT).map((part) =>
        db
          .select({ id: emailMessage.id })
          .from(emailMessage)
          .where(and(eq(emailMessage.userId, userId), inArray(emailMessage.id, part))),
      ),
    ),
  );
  const emails = found.flat();
  if (!emails.length) return;
  const viewedAt = new Date().toISOString();
  const inserts = chunk(emails, 20).map((part) =>
    db
      .insert(emailLink)
      .values(part.map((e) => ({ id: e.id, applicationId, userId, viewedAt })))
      .onConflictDoNothing(),
  );
  const marks = chunk(emails.map((e) => e.id), MAX_IDS_PER_STATEMENT).map((ids) => markThreadsForRefetch(db, userId, ids));
  await db.batch(asBatch([...inserts, ...marks]));
  await invalidate(UNREAD_COUNTS_CACHE, userId);
}

export async function dismissSuggestions(db: Db, userId: string, emailIds: string[]) {
  if (!emailIds.length) return;
  const dismissedAt = new Date().toISOString();
  const updates = chunk(emailIds, MAX_IDS_PER_STATEMENT).map((part) =>
    db
      .update(emailMessage)
      .set({ suggestionDismissedAt: dismissedAt })
      .where(and(eq(emailMessage.userId, userId), inArray(emailMessage.id, part))),
  );
  await db.batch(asBatch(updates));
}

export async function moveEmail(db: Db, userId: string, fromApplicationId: string, emailId: string, toApplicationId: string) {
  const [[target], [link]] = await db.batch([
    db
      .select({ id: application.id })
      .from(application)
      .where(and(eq(application.id, toApplicationId), eq(application.userId, userId), ne(application.status, "saved"))),
    db
      .select({ id: emailLink.id })
      .from(emailLink)
      .where(and(eq(emailLink.userId, userId), eq(emailLink.applicationId, fromApplicationId), eq(emailLink.id, emailId))),
  ]);
  if (!target || !link || fromApplicationId === toApplicationId) return false;
  await db.batch([
    db
      .delete(emailLink)
      .where(and(eq(emailLink.userId, userId), eq(emailLink.applicationId, fromApplicationId), eq(emailLink.id, emailId))),
    db
      .insert(emailLink)
      .values({ id: emailId, applicationId: toApplicationId, userId, viewedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [emailLink.id, emailLink.applicationId], set: { dismissedAt: null } }),
  ]);
  await invalidate(UNREAD_COUNTS_CACHE, userId);
  return true;
}
