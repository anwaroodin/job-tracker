import { ANALYTICS_CACHE, invalidate } from "../../cache.server";
import { asBatch } from "../../db/batch.server";
import type { Db } from "../../db/client.server";
import { settingsRowFor, withDefaults } from "../../db/queries/settings.server";
import {
  applicationsFor,
  lastStageEvidencePerApplication,
  latestStageEmailPerApplication,
  setApplicationStatus,
} from "../../db/queries/status.server";
import { clearBookmarkOnApply, refreshedStatus, type StatusChange } from "./rules";

export async function refreshApplicationStatus(
  db: Db,
  userId: string,
  applicationId?: string,
  knownMinConfidence?: number,
): Promise<StatusChange[]> {
  const minConfidence = knownMinConfidence ?? withDefaults((await settingsRowFor(db, userId))[0]).minConfidence;
  const [apps, latestStages, evidence] = await db.batch([
    applicationsFor(db, userId, applicationId),
    latestStageEmailPerApplication(db, userId, minConfidence, applicationId),
    lastStageEvidencePerApplication(db, userId, minConfidence, applicationId),
  ]);
  const latestByApplication = new Map(latestStages.map((stage) => [stage.applicationId, stage]));
  const lastEvidenceAt = new Map(evidence.map((row) => [row.applicationId, row.receivedAt]));
  const updatedAt = new Date().toISOString();

  const changes = apps.flatMap((app): StatusChange[] => {
    const status = refreshedStatus(app, lastEvidenceAt.get(app.id), latestByApplication.get(app.id)?.category);
    return status === null ? [] : [{ applicationId: app.id, from: app.status, to: status }];
  });
  const updates = changes.map((change) =>
    setApplicationStatus(db, userId, change.applicationId, clearBookmarkOnApply(change.from, { status: change.to, updatedAt })),
  );
  if (updates.length) {
    await db.batch(asBatch(updates));
    await invalidate(ANALYTICS_CACHE, userId);
  }
  return changes;
}
