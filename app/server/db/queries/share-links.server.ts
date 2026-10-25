import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "../client.server";
import { application, shareLink, user } from "../schema";

const owned = (userId: string, applicationId: string) => and(eq(shareLink.userId, userId), eq(shareLink.applicationId, applicationId));
const live = (userId: string, applicationId: string, now: string) => and(owned(userId, applicationId), gt(shareLink.expiresAt, now));

export async function shareLinkFor(db: Db, userId: string, applicationId: string, now: string) {
  const [row] = await db
    .select({ includeCv: shareLink.includeCv, expiresAt: shareLink.expiresAt })
    .from(shareLink)
    .where(live(userId, applicationId, now))
    .limit(1);
  return row ?? null;
}

export function putShareLink(db: Db, row: { userId: string; applicationId: string; tokenHash: string; includeCv: boolean; expiresAt: string }) {
  const createdAt = new Date().toISOString();
  return db
    .insert(shareLink)
    .values({ id: crypto.randomUUID(), createdAt, ...row })
    .onConflictDoUpdate({
      target: [shareLink.userId, shareLink.applicationId],
      set: { tokenHash: row.tokenHash, includeCv: row.includeCv, expiresAt: row.expiresAt, createdAt },
    });
}

export function updateShareLink(db: Db, userId: string, applicationId: string, now: string, patch: { includeCv?: boolean; expiresAt?: string }) {
  return db.update(shareLink).set(patch).where(live(userId, applicationId, now));
}

export function deleteShareLink(db: Db, userId: string, applicationId: string) {
  return db.delete(shareLink).where(owned(userId, applicationId));
}

export async function liveShareLink(db: Db, tokenHash: string, now: string) {
  const [row] = await db
    .select({
      userId: shareLink.userId,
      applicationId: shareLink.applicationId,
      includeCv: shareLink.includeCv,
      expiresAt: shareLink.expiresAt,
      account: { name: user.name, email: user.email },
    })
    .from(shareLink)
    .innerJoin(user, eq(user.id, shareLink.userId))
    .where(and(eq(shareLink.tokenHash, tokenHash), gt(shareLink.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export function activeShareLinks(db: Db, userId: string, now: string) {
  return db
    .select({
      applicationId: shareLink.applicationId,
      company: application.company,
      role: application.role,
      includeCv: shareLink.includeCv,
      expiresAt: shareLink.expiresAt,
    })
    .from(shareLink)
    .innerJoin(application, eq(application.id, shareLink.applicationId))
    .where(and(eq(shareLink.userId, userId), gt(shareLink.expiresAt, now)))
    .orderBy(asc(shareLink.expiresAt));
}
