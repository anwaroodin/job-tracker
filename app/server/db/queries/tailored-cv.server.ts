import { and, desc, eq, sql } from "drizzle-orm";
import type { TailoredCv, TailoredCvCard } from "~/types/cv";
import type { Db } from "../client.server";
import { skillGroups } from "../../cv/clean";
import { application, tailoredCv } from "../schema";

function parseTailored(json: string): TailoredCv {
  const cv = JSON.parse(json) as TailoredCv;
  return { ...cv, skills: skillGroups(cv.skills) };
}

export async function latestTailoredCv(db: Db, userId: string, applicationId: string) {
  const [row] = await db
    .select()
    .from(tailoredCv)
    .where(and(eq(tailoredCv.userId, userId), eq(tailoredCv.applicationId, applicationId)))
    .orderBy(desc(tailoredCv.version))
    .limit(1);
  return row ? { version: row.version, createdAt: row.createdAt, cv: parseTailored(row.json) } : null;
}

export function insertTailoredCv(db: Db, userId: string, applicationId: string, version: number, cv: TailoredCv) {
  return db.insert(tailoredCv).values({
    id: crypto.randomUUID(),
    userId,
    applicationId,
    version,
    json: JSON.stringify(cv),
    createdAt: new Date().toISOString(),
  });
}

export async function tailoredCvCards(db: Db, userId: string): Promise<TailoredCvCard[]> {
  const rows = await db
    .select({
      applicationId: tailoredCv.applicationId,
      company: application.company,
      role: application.role,
      version: tailoredCv.version,
      createdAt: tailoredCv.createdAt,
      json: tailoredCv.json,
    })
    .from(tailoredCv)
    .innerJoin(application, eq(application.id, tailoredCv.applicationId))
    .where(
      and(
        eq(tailoredCv.userId, userId),
        sql`${tailoredCv.version} = (select max(t.version) from ${tailoredCv} t where t.application_id = ${tailoredCv.applicationId})`,
      ),
    )
    .orderBy(desc(tailoredCv.createdAt));
  return rows.map(({ json, ...row }) => {
    const { coverLetter: _, changes: __, flags: ___, ...cv } = parseTailored(json);
    return { ...row, cv };
  });
}
