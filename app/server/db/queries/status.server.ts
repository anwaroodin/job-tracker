import { and, eq, gte, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { NON_STAGE_CATEGORIES } from "~/lib/status";
import type { Db } from "../client.server";
import { application, emailLink, emailMessage } from "../schema";

export function applicationsFor(db: Db, userId: string, applicationId?: string) {
  return db
    .select({
      id: application.id,
      company: application.company,
      role: application.role,
      appliedAt: application.appliedAt,
      status: application.status,
      manualStatusAt: application.manualStatusAt,
    })
    .from(application)
    .where(and(eq(application.userId, userId), applicationId ? eq(application.id, applicationId) : undefined));
}

export function lastStageEvidencePerApplication(db: Db, userId: string, applicationId?: string) {
  return db
    .select({ applicationId: emailLink.applicationId, receivedAt: sql<string>`max(${emailMessage.receivedAt})` })
    .from(emailLink)
    .innerJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(
      and(
        eq(emailLink.userId, userId),
        applicationId ? eq(emailLink.applicationId, applicationId) : undefined,
        or(notInArray(emailMessage.category, NON_STAGE_CATEGORIES), isNotNull(emailMessage.manualCategoryAt)),
      ),
    )
    .groupBy(emailLink.applicationId);
}

export function latestStageEmailPerApplication(db: Db, userId: string, minConfidence: number, applicationId?: string) {
  return db
    .select({
      applicationId: emailLink.applicationId,
      category: emailMessage.category,
      receivedAt: sql<string>`max(${emailMessage.receivedAt})`,
    })
    .from(emailLink)
    .innerJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(
      and(
        eq(emailLink.userId, userId),
        applicationId ? eq(emailLink.applicationId, applicationId) : undefined,
        isNull(emailLink.dismissedAt),
        notInArray(emailMessage.category, NON_STAGE_CATEGORIES),
        or(
          isNull(emailMessage.confidence),
          gte(emailMessage.confidence, minConfidence),
          isNotNull(emailMessage.manualCategoryAt),
        ),
      ),
    )
    .groupBy(emailLink.applicationId);
}

export function setApplicationStatus(db: Db, userId: string, applicationId: string, patch: Partial<typeof application.$inferInsert>) {
  return db
    .update(application)
    .set(patch)
    .where(and(eq(application.id, applicationId), eq(application.userId, userId)));
}
