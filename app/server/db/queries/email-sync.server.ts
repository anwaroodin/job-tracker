import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../client.server";
import { awaitsDetails, awaitsSuggestion, isStageEmail } from "../predicates";
import { emailLink, emailMessage } from "../schema";

export function importedLinksMissingDetails(db: Db, userId: string) {
  return db
    .selectDistinct({ id: emailLink.id })
    .from(emailLink)
    .leftJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(and(eq(emailLink.userId, userId), isNull(emailLink.dismissedAt), sql`${emailMessage.id} is null`));
}

export function storedEmails(db: Db, userId: string) {
  return db
    .select({
      id: emailMessage.id,
      category: emailMessage.category,
      confidence: emailMessage.confidence,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        ne(emailMessage.category, "deleted"),
        isNull(emailMessage.manualCategoryAt),
        // Stubs have nothing left to classify; they're downloaded again instead (email/retention.server.ts).
        isNull(emailMessage.prunedAt),
      ),
    );
}

export function storedEmailIdsSince(db: Db, userId: string, since: number) {
  return db
    .select({ id: emailMessage.id })
    .from(emailMessage)
    .where(and(eq(emailMessage.userId, userId), gte(emailMessage.receivedAt, new Date(since).toISOString())));
}

export function unlinkedStageEmails(db: Db, userId: string, since: number) {
  return db
    .select()
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        gte(emailMessage.receivedAt, new Date(since).toISOString()),
        isStageEmail(emailMessage),
        sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
      ),
    )
    .orderBy(emailMessage.receivedAt);
}

export function emailsNeedingSuggestion(db: Db, userId: string, since: string, limit: number) {
  return db
    .select({
      id: emailMessage.id,
      category: emailMessage.category,
      receivedAt: emailMessage.receivedAt,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        awaitsSuggestion(emailMessage),
        gte(emailMessage.receivedAt, since),
        sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
      ),
    )
    .orderBy(desc(emailMessage.receivedAt))
    .limit(limit);
}

export function emailsNeedingDetails(db: Db, userId: string, since: string, limit: number) {
  return db
    .select({
      id: emailMessage.id,
      applicationId: sql<string>`(select ${emailLink.applicationId} from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id} and ${emailLink.dismissedAt} is null limit 1)`,
      category: emailMessage.category,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
      receivedAt: emailMessage.receivedAt,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        awaitsDetails(emailMessage),
        gte(emailMessage.receivedAt, since),
        sql`exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id} and ${emailLink.dismissedAt} is null)`,
      ),
    )
    .orderBy(desc(emailMessage.receivedAt))
    .limit(limit);
}

export function setCategory(db: Db, userId: string, change: { id: string; category: string; confidence: number | null }) {
  return db
    .update(emailMessage)
    .set({
      category: change.category,
      confidence: change.confidence,
      detailsAt: sql`case when ${emailMessage.category} = ${change.category} then ${emailMessage.detailsAt} else null end`,
    })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, change.id)));
}

export function markLinksViewed(db: Db, userId: string, ids: string[], viewedAt: string) {
  return db
    .update(emailLink)
    .set({ viewedAt })
    .where(and(eq(emailLink.userId, userId), inArray(emailLink.id, ids), sql`${emailLink.viewedAt} is null`));
}

export function linkEmail(db: Db, userId: string, emailId: string, applicationId: string) {
  return db.insert(emailLink).values({ id: emailId, applicationId, userId }).onConflictDoNothing();
}

export function updateEmail(db: Db, userId: string, emailId: string, values: Partial<typeof emailMessage.$inferInsert>) {
  return db
    .update(emailMessage)
    .set(values)
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, emailId)));
}
