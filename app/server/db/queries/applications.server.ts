import { and, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import { ANALYTICS_CACHE, invalidate } from "../../cache.server";
import type { Db } from "../client.server";
import { application, type NewApplication } from "../schema";

const nowIso = () => new Date().toISOString();

export function applicationRows(db: Db, userId: string) {
  return db
    .select()
    .from(application)
    .where(eq(application.userId, userId))
    .orderBy(desc(application.appliedAt), desc(application.updatedAt));
}

export function applicationById(db: Db, userId: string, id: string) {
  return db
    .select()
    .from(application)
    .where(and(eq(application.id, id), eq(application.userId, userId)))
    .limit(1);
}

export async function getApplication(db: Db, userId: string, id: string) {
  const [row] = await applicationById(db, userId, id);
  return row ?? null;
}

export async function findRecentDuplicate(
  db: Db,
  userId: string,
  match: { url: string; company: string; role: string },
  sinceDays = 30,
) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
  const sameRole = and(
    sql`lower(${application.company}) = ${match.company.toLowerCase()}`,
    sql`lower(${application.role}) = ${match.role.toLowerCase()}`,
  );
  const rows = await db
    .select()
    .from(application)
    .where(
      and(
        eq(application.userId, userId),
        gte(application.appliedAt, since),
        match.url ? or(eq(application.url, match.url), sameRole) : sameRole,
      ),
    )
    .orderBy(
      ...(match.url ? [desc(sql`${application.url} = ${match.url}`)] : []),
      desc(application.appliedAt),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createApplication(
  db: Db,
  input: Omit<NewApplication, "appliedAt" | "updatedAt"> & {
    appliedAt?: string;
  },
) {
  const ts = nowIso();
  const row: NewApplication = {
    ...input,
    appliedAt: input.appliedAt ?? ts,
    updatedAt: ts,
  };
  const [created] = await db.insert(application).values(row).returning();
  await invalidate(ANALYTICS_CACHE, row.userId);
  return created;
}

export async function updateApplication(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<NewApplication>,
) {
  const [updated] = await db
    .update(application)
    .set({ ...patch, updatedAt: nowIso() })
    .where(and(eq(application.id, id), eq(application.userId, userId)))
    .returning();
  await invalidate(ANALYTICS_CACHE, userId);
  return updated ?? null;
}

export function deleteSavedApplication(db: Db, userId: string, id: string) {
  return db
    .delete(application)
    .where(and(eq(application.id, id), eq(application.userId, userId), eq(application.status, "saved")))
    .returning({ id: application.id });
}

export function updateSavedApplication(db: Db, userId: string, id: string, patch: Partial<NewApplication>) {
  return db
    .update(application)
    .set(patch)
    .where(and(eq(application.id, id), eq(application.userId, userId), eq(application.status, "saved")))
    .returning({ id: application.id });
}

export async function applicationStats(db: Db, userId: string) {
  const rows = await db
    .select({
      status: application.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(application)
    .where(and(eq(application.userId, userId), ne(application.status, "saved")))
    .groupBy(application.status);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] = r.count;
    total += r.count;
  }
  return { total, byStatus };
}

export function earliestApplication(db: Db, userId: string) {
  return db
    .select({ appliedAt: application.appliedAt })
    .from(application)
    .where(eq(application.userId, userId))
    .orderBy(application.appliedAt)
    .limit(1);
}
