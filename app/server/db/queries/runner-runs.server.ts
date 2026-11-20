import { and, desc, eq, getTableColumns, gte } from "drizzle-orm";
import type { Db } from "../client.server";
import { application, roleCv, runnerRun, runnerStage } from "../schema";

export type NewRun = typeof runnerRun.$inferInsert;
export type NewStage = typeof runnerStage.$inferInsert;

const mine = (userId: string, id: string) => and(eq(runnerRun.userId, userId), eq(runnerRun.id, id));

export function insertRun(db: Db, run: NewRun) {
  return db.insert(runnerRun).values(run).onConflictDoNothing();
}

export function runFor(db: Db, userId: string, id: string) {
  return db.select().from(runnerRun).where(mine(userId, id)).get();
}

export function insertStage(db: Db, stage: NewStage) {
  return db.insert(runnerStage).values(stage);
}

export function finishRun(db: Db, userId: string, id: string, patch: Partial<NewRun>) {
  return db.update(runnerRun).set(patch).where(mine(userId, id));
}

export function runsSince(db: Db, userId: string, since: string) {
  return db
    .select({ ...getTableColumns(runnerRun), company: application.company, roleTitle: roleCv.title })
    .from(runnerRun)
    .leftJoin(application, eq(application.id, runnerRun.applicationId))
    .leftJoin(roleCv, eq(roleCv.id, runnerRun.roleCvId))
    .where(and(eq(runnerRun.userId, userId), gte(runnerRun.startedAt, since)))
    .orderBy(desc(runnerRun.startedAt));
}

export function stagesSince(db: Db, userId: string, since: string) {
  return db
    .select(getTableColumns(runnerStage))
    .from(runnerStage)
    .innerJoin(runnerRun, eq(runnerRun.id, runnerStage.runId))
    .where(and(eq(runnerRun.userId, userId), gte(runnerRun.startedAt, since)));
}
