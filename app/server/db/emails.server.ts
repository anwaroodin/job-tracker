import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "./client.server";
import { emailLink, emailMessage } from "./schema";

export async function getApplicationEmails(db: Db, userId: string, applicationId: string) {
  const rows = await db
    .select({
      id: emailLink.id,
      threadId: emailMessage.threadId,
      viewedAt: emailLink.viewedAt,
      category: emailMessage.category,
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
  // unsynced and deleted emails have no date, push them to the bottom
  const key = (r: (typeof rows)[number]) => r.receivedAt || "~";
  return rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export async function unreadEmailCounts(db: Db, userId: string) {
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
        sql`${emailLink.viewedAt} is null`,
        ne(emailMessage.category, "deleted"),
      ),
    )
    .groupBy(emailLink.applicationId);
  return Object.fromEntries(rows.map((r) => [r.applicationId, r.count]));
}

export async function markViewed(db: Db, userId: string, ids: string[]) {
  const now = new Date().toISOString();
  // d1 only allows 100 bound params per query
  for (let i = 0; i < ids.length; i += 90) {
    await db
      .update(emailLink)
      .set({ viewedAt: now })
      .where(
        and(
          eq(emailLink.userId, userId),
          inArray(emailLink.id, ids.slice(i, i + 90)),
          sql`${emailLink.viewedAt} is null`,
        ),
      );
  }
}
