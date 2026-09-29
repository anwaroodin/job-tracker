import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import type { Db } from "./client.server";
import { deduplicateApplications } from "./applications.server";
import { application, emailLink, emailMessage } from "./schema";

export interface SearchApplicationItem {
  id: string;
  company: string;
  role: string;
  location: string;
  status: string;
  appliedAt: string;
  updatedAt?: string;
  starred: boolean;
}

export interface SearchEmailItem {
  id: string;
  subject: string;
  fromAddress: string;
  snippet: string;
  receivedAt: string;
  category: string;
  applicationId: string;
  company: string;
  role: string;
}

export interface SearchResults {
  applications: SearchApplicationItem[];
  emails: SearchEmailItem[];
}

export async function globalSearch(
  db: Db,
  userId: string,
  query: string,
): Promise<SearchResults> {
  const q = query.trim().toLowerCase();

  if (!q) {
    // When no query is provided, return recent applications and recent job-linked emails
    const [recentApps, recentEmails] = await Promise.all([
      db
        .select({
          id: application.id,
          company: application.company,
          role: application.role,
          location: application.location,
          status: application.status,
          appliedAt: application.appliedAt,
          updatedAt: application.updatedAt,
          starred: application.starred,
        })
        .from(application)
        .where(eq(application.userId, userId))
        .orderBy(desc(application.updatedAt), desc(application.appliedAt))
        .limit(30),

      db
        .select({
          id: emailMessage.id,
          subject: emailMessage.subject,
          fromAddress: emailMessage.fromAddress,
          snippet: emailMessage.snippet,
          receivedAt: emailMessage.receivedAt,
          category: emailMessage.category,
          applicationId: emailLink.applicationId,
          company: application.company,
          role: application.role,
        })
        .from(emailMessage)
        .innerJoin(
          emailLink,
          and(
            eq(emailLink.id, emailMessage.id),
            eq(emailLink.userId, userId),
            isNull(emailLink.dismissedAt),
          ),
        )
        .innerJoin(
          application,
          and(
            eq(application.id, emailLink.applicationId),
            eq(application.userId, userId),
          ),
        )
        .where(eq(emailMessage.userId, userId))
        .orderBy(desc(emailMessage.receivedAt))
        .limit(6),
    ]);

    return {
      applications: deduplicateApplications(recentApps).slice(0, 6),
      emails: recentEmails,
    };
  }

  const pattern = `%${q}%`;

  const [apps, emails] = await Promise.all([
    db
      .select({
        id: application.id,
        company: application.company,
        role: application.role,
        location: application.location,
        status: application.status,
        appliedAt: application.appliedAt,
        updatedAt: application.updatedAt,
        starred: application.starred,
      })
      .from(application)
      .where(
        and(
          eq(application.userId, userId),
          or(
            like(sql`lower(${application.company})`, pattern),
            like(sql`lower(${application.role})`, pattern),
            like(sql`lower(${application.location})`, pattern),
            like(sql`lower(${application.status})`, pattern),
            like(sql`lower(${application.notes})`, pattern),
          ),
        ),
      )
      .orderBy(desc(application.appliedAt), desc(application.updatedAt))
      .limit(60),

    db
      .select({
        id: emailMessage.id,
        subject: emailMessage.subject,
        fromAddress: emailMessage.fromAddress,
        snippet: emailMessage.snippet,
        receivedAt: emailMessage.receivedAt,
        category: emailMessage.category,
        applicationId: emailLink.applicationId,
        company: application.company,
        role: application.role,
      })
      .from(emailMessage)
      .innerJoin(
        emailLink,
        and(
          eq(emailLink.id, emailMessage.id),
          eq(emailLink.userId, userId),
          isNull(emailLink.dismissedAt),
        ),
      )
      .innerJoin(
        application,
        and(
          eq(application.id, emailLink.applicationId),
          eq(application.userId, userId),
        ),
      )
      .where(
        and(
          eq(emailMessage.userId, userId),
          or(
            like(sql`lower(${emailMessage.subject})`, pattern),
            like(sql`lower(${emailMessage.fromAddress})`, pattern),
            like(sql`lower(${emailMessage.snippet})`, pattern),
            like(sql`lower(${application.company})`, pattern),
            like(sql`lower(${application.role})`, pattern),
          ),
        ),
      )
      .orderBy(desc(emailMessage.receivedAt))
      .limit(12),
  ]);

  return {
    applications: deduplicateApplications(apps).slice(0, 12),
    emails,
  };
}
