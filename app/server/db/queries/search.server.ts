import { and, desc, eq, isNull, or, sql, type SQLWrapper } from "drizzle-orm";
import type { Db } from "../client.server";
import { application, emailLink, emailMessage } from "../schema";

const applicationFields = {
  id: application.id,
  company: application.company,
  role: application.role,
  location: application.location,
  status: application.status,
  appliedAt: application.appliedAt,
  updatedAt: application.updatedAt,
  starred: application.starred,
};

const emailFields = {
  id: emailMessage.id,
  subject: emailMessage.subject,
  fromAddress: emailMessage.fromAddress,
  snippet: emailMessage.snippet,
  receivedAt: emailMessage.receivedAt,
  category: emailMessage.category,
  applicationId: emailLink.applicationId,
  company: application.company,
  role: application.role,
};

function linkedEmails(db: Db, userId: string) {
  return db
    .select(emailFields)
    .from(emailMessage)
    .innerJoin(emailLink, and(eq(emailLink.id, emailMessage.id), eq(emailLink.userId, userId), isNull(emailLink.dismissedAt)))
    .innerJoin(application, and(eq(application.id, emailLink.applicationId), eq(application.userId, userId)));
}

function contains(column: SQLWrapper, pattern: string) {
  return sql`lower(${column}) like ${pattern} escape '\\'`;
}

export function recentSearchRows(db: Db, userId: string) {
  return db.batch([
    db
      .select(applicationFields)
      .from(application)
      .where(eq(application.userId, userId))
      .orderBy(desc(application.updatedAt), desc(application.appliedAt))
      .limit(30),
    linkedEmails(db, userId).where(eq(emailMessage.userId, userId)).orderBy(desc(emailMessage.receivedAt)).limit(6),
  ]);
}

export function matchingSearchRows(db: Db, userId: string, q: string) {
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db.batch([
    db
      .select(applicationFields)
      .from(application)
      .where(
        and(
          eq(application.userId, userId),
          or(
            ...[application.company, application.role, application.location, application.status, application.notes].map(
              (column) => contains(column, pattern),
            ),
          ),
        ),
      )
      .orderBy(desc(application.appliedAt), desc(application.updatedAt))
      .limit(60),
    linkedEmails(db, userId)
      .where(
        and(
          eq(emailMessage.userId, userId),
          or(
            ...[emailMessage.subject, emailMessage.fromAddress, emailMessage.snippet, application.company, application.role].map(
              (column) => contains(column, pattern),
            ),
          ),
        ),
      )
      .orderBy(desc(emailMessage.receivedAt))
      .limit(12),
  ]);
}
