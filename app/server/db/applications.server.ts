import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client.server";
import { application, type NewApplication } from "./schema";

const nowIso = () => new Date().toISOString();

export async function listApplications(db: Db, userId: string) {
  return db
    .select()
    .from(application)
    .where(eq(application.userId, userId))
    .orderBy(desc(application.appliedAt));
}

export async function getApplication(db: Db, userId: string, id: string) {
  const rows = await db
    .select()
    .from(application)
    .where(and(eq(application.id, id), eq(application.userId, userId)))
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
  await db.insert(application).values(row);
  return row;
}

export async function updateApplication(
  db: Db,
  userId: string,
  id: string,
  patch: Partial<NewApplication>,
) {
  await db
    .update(application)
    .set({ ...patch, updatedAt: nowIso() })
    .where(and(eq(application.id, id), eq(application.userId, userId)));
}

export async function deleteApplication(db: Db, userId: string, id: string) {
  await db
    .delete(application)
    .where(and(eq(application.id, id), eq(application.userId, userId)));
}

export async function applicationStats(db: Db, userId: string) {
  const rows = await db
    .select({
      status: application.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(application)
    .where(eq(application.userId, userId))
    .groupBy(application.status);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] = r.count;
    total += r.count;
  }
  return { total, byStatus };
}
