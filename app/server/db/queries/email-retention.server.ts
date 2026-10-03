/**
 * Keeps as little as possible about emails that aren't about jobs.
 *
 */
import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "../client.server";
import { isStub, isUnprunedOther, STUB_REFETCH_FOR_THREAD } from "../predicates";
import { emailLink, emailMessage } from "../schema";

/** How many stubs one sync run downloads again, alongside new mail. */
export const REFETCH_PER_RUN = 50;

// A second reference to email_message for the thread lookups. In a raw sql
// template Drizzle doesn't declare the alias, so FROM does it by hand.
const OTHER = "thread_email";
const other = alias(emailMessage, OTHER);
const fromOther = sql`${emailMessage} ${sql.identifier(OTHER)}`;

/** Whether the email (row `e`) is linked to an application. */
const isLinked = (e: typeof emailMessage | typeof other) =>
  sql`exists (select 1 from ${emailLink} where ${emailLink.userId} = ${e.userId} and ${emailLink.id} = ${e.id})`;

/** Whether another email in the same thread is job-related in its own right. */
function threadHasJobEmail(e: typeof emailMessage): SQL {
  return sql`(${e.threadId} is not null and exists (
    select 1 from ${fromOther}
    where ${other.userId} = ${e.userId}
      and ${other.threadId} = ${e.threadId}
      and ${other.id} != ${e.id}
      and ${other.prunedAt} is null
      and (${other.category} not in ('other', 'deleted') or ${other.manualCategoryAt} is not null or ${isLinked(other)})
  ))`;
}

function stubsWhere(db: Db, userId: string, condition: SQL | undefined) {
  return db
    .select({ id: emailMessage.id, receivedAt: emailMessage.receivedAt })
    .from(emailMessage)
    .where(and(eq(emailMessage.userId, userId), isStub(emailMessage), condition));
}

export async function prunedEmailsToFetchAgain(db: Db, userId: string, classifier: string | null, since: number) {
  const recentFrom = new Date(since).toISOString();
  const [inJobThread, ...judgedByAnother] = await db.batch([
    stubsWhere(db, userId, eq(emailMessage.prunedClassifier, STUB_REFETCH_FOR_THREAD)),
    ...(classifier
      ? [
          stubsWhere(db, userId, isNull(emailMessage.prunedClassifier)),
          stubsWhere(db, userId, lt(emailMessage.prunedClassifier, classifier)),
          stubsWhere(db, userId, gt(emailMessage.prunedClassifier, classifier)),
        ]
      : []),
  ]);
  const recent = judgedByAnother.flat().filter((row) => row.receivedAt >= recentFrom);
  const byId = new Map([...inJobThread, ...recent].map((row) => [row.id, row]));
  return [...byId.values()]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, REFETCH_PER_RUN)
    .map(({ id }) => ({ id }));
}

export function markThreadsForRefetch(db: Db, userId: string, jobEmailIds: string[]) {
  return db
    .update(emailMessage)
    .set({ prunedClassifier: STUB_REFETCH_FOR_THREAD })
    .where(
      and(
        eq(emailMessage.userId, userId),
        isStub(emailMessage),
        sql`${emailMessage.threadId} in (${db
          .select({ threadId: other.threadId })
          .from(other)
          .where(and(eq(other.userId, userId), inArray(other.id, jobEmailIds)))})`,
      ),
    );
}

const CLEARED = {
  subject: "",
  snippet: "",
  fromName: "",
  fromAddress: "",
  confidence: null,
  manualKind: null,
  detailsAt: null,
  eventAt: null,
  eventText: null,
  actionUrl: null,
  actionText: null,
  needsReply: null,
  replyDoneAt: null,
  suggestionAt: null,
  isApplication: null,
  suggestedCompany: null,
  suggestedRole: null,
  suggestionConfidence: null,
  suggestionDismissedAt: null,
};

const isUnrelated = and(
  isUnprunedOther(emailMessage),
  sql`not ${isLinked(emailMessage)}`,
  sql`not ${threadHasJobEmail(emailMessage)}`,
);

/**
 * Clears everything but the stub fields from emails now known not to be about
 * jobs, recording `classifier` (the run's classifier) as what judged them.
 */
export function pruneUnrelatedEmails(db: Db, userId: string, classifier: string, prunedAt: string, minConfidence: number) {
  return db
    .update(emailMessage)
    .set({ prunedAt, prunedClassifier: classifier, ...CLEARED })
    .where(
      and(
        eq(emailMessage.userId, userId),
        isUnrelated,
        isNull(emailMessage.manualCategoryAt),
        or(isNull(emailMessage.confidence), gte(emailMessage.confidence, minConfidence)),
      ),
    );
}

export function unsureUnrelatedEmails(db: Db, userId: string, minConfidence: number) {
  return db
    .select({
      id: emailMessage.id,
      threadId: emailMessage.threadId,
      subject: emailMessage.subject,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
      receivedAt: emailMessage.receivedAt,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        isUnrelated,
        isNull(emailMessage.manualCategoryAt),
        lt(emailMessage.confidence, minConfidence),
      ),
    )
    .orderBy(desc(emailMessage.receivedAt));
}

export function pruneConfirmedEmail(db: Db, userId: string, emailId: string, classifier: string, prunedAt: string) {
  return db
    .update(emailMessage)
    .set({ prunedAt, prunedClassifier: classifier, ...CLEARED })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, emailId), isUnrelated));
}

export function saveEmail(db: Db, row: typeof emailMessage.$inferInsert) {
  const { userId: _userId, id: _id, receivedAt, ...rest } = row;
  const content = receivedAt ? { ...rest, receivedAt } : rest;
  return db
    .insert(emailMessage)
    .values(row)
    .onConflictDoUpdate({
      target: [emailMessage.userId, emailMessage.id],
      set: { ...content, prunedAt: null, prunedClassifier: null },
      setWhere: isNotNull(emailMessage.prunedAt),
    });
}

export function markJudgedBy(db: Db, userId: string, ids: string[], classifier: string) {
  return db
    .update(emailMessage)
    .set({ prunedClassifier: classifier })
    .where(and(eq(emailMessage.userId, userId), isNotNull(emailMessage.prunedAt), inArray(emailMessage.id, ids)));
}
