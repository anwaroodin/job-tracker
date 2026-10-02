/**
 * Keeps as little as possible about emails that aren't about jobs.
 *
 */
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "../client.server";
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

export function prunedEmailsToFetchAgain(db: Db, userId: string, classifier: string | null, since: number) {
  const judgedByAnother = classifier
    ? sql`(coalesce(${emailMessage.prunedClassifier}, '') != ${classifier} and ${gte(
        emailMessage.receivedAt,
        new Date(since).toISOString(),
      )})`
    : sql`0`;
  return db
    .select({ id: emailMessage.id })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        isNotNull(emailMessage.prunedAt),
        sql`(${threadHasJobEmail(emailMessage)} or ${judgedByAnother})`,
      ),
    )
    .orderBy(desc(emailMessage.receivedAt))
    .limit(REFETCH_PER_RUN);
}

/**
 * Clears everything but the stub fields from emails now known not to be about
 * jobs, recording `classifier` (the run's classifier) as what judged them.
 */
export function pruneUnrelatedEmails(db: Db, userId: string, classifier: string, prunedAt: string) {
  return db
    .update(emailMessage)
    .set({
      prunedAt,
      prunedClassifier: classifier,
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
    })
    .where(
      and(
        eq(emailMessage.userId, userId),
        isNull(emailMessage.prunedAt),
        eq(emailMessage.category, "other"),
        isNull(emailMessage.manualCategoryAt),
        sql`not ${isLinked(emailMessage)}`,
        sql`not ${threadHasJobEmail(emailMessage)}`,
      ),
    );
}

export function saveEmail(db: Db, row: typeof emailMessage.$inferInsert) {
  const { userId: _userId, id: _id, ...content } = row;
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
