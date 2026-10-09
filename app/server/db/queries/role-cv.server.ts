import { and, desc, eq } from "drizzle-orm";
import type { JobKeywords, TailoredCv } from "~/types/cv";
import type { Db } from "../client.server";
import { skillGroups } from "../../cv/clean";
import { roleCv } from "../schema";

const mine = (userId: string, id: string) => and(eq(roleCv.userId, userId), eq(roleCv.id, id));

function parsed(row: typeof roleCv.$inferSelect) {
  const cv = row.json ? (JSON.parse(row.json) as TailoredCv) : null;
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    updatedAt: row.updatedAt,
    keywords: row.keywordsJson ? (JSON.parse(row.keywordsJson) as JobKeywords) : null,
    cv: cv && { ...cv, skills: skillGroups(cv.skills) },
  };
}

export async function createRoleCv(db: Db, userId: string, title: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(roleCv).values({ id, userId, title, createdAt: now, updatedAt: now });
  return id;
}

export async function getRoleCv(db: Db, userId: string, id: string) {
  const [row] = await db.select().from(roleCv).where(mine(userId, id)).limit(1);
  return row ? parsed(row) : null;
}

export function listRoleCvs(db: Db, userId: string) {
  return db
    .select({ id: roleCv.id, title: roleCv.title, version: roleCv.version, updatedAt: roleCv.updatedAt })
    .from(roleCv)
    .where(eq(roleCv.userId, userId))
    .orderBy(desc(roleCv.updatedAt));
}

export function saveRoleKeywords(db: Db, userId: string, id: string, keywords: JobKeywords) {
  return db.update(roleCv).set({ keywordsJson: JSON.stringify(keywords) }).where(mine(userId, id));
}

export function saveRoleCv(db: Db, userId: string, id: string, version: number, cv: TailoredCv) {
  return db.update(roleCv).set({ json: JSON.stringify(cv), version, updatedAt: new Date().toISOString() }).where(mine(userId, id));
}

export function deleteRoleCv(db: Db, userId: string, id: string) {
  return db.delete(roleCv).where(mine(userId, id));
}
