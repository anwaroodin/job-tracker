import { and, desc, eq, gte, ne, or, sql } from "drizzle-orm";
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

export function clearBookmarkOnApply(currentStatus: string, patch: Partial<NewApplication>) {
  const leavingSaved = currentStatus === "saved" && patch.status !== undefined && patch.status !== "saved";
  if (leavingSaved && patch.starred === undefined) patch.starred = false;
  return patch;
}

/**
 * Turns a saved posting into an application dated today, or deletes it.
 * Returns false when the row isn't a saved posting.
 */
export async function settleSavedJob(db: Db, userId: string, id: string, outcome: "applied" | "removed") {
  const row = await getApplication(db, userId, id);
  if (row?.status !== "saved") return false;
  if (outcome === "removed") await deleteApplication(db, userId, id);
  else {
    const now = nowIso();
    const patch = { status: "applied", manualStatusAt: now, appliedAt: now };
    await updateApplication(db, userId, id, clearBookmarkOnApply(row.status, patch));
  }
  return true;
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
