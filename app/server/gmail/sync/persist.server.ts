import { chunk } from "~/lib/array";
import { ANALYTICS_CACHE, invalidate, UNREAD_COUNTS_CACHE } from "../../cache.server";
import { asBatch, MAX_IDS_PER_STATEMENT } from "../../db/batch.server";
import type { Db } from "../../db/client.server";
import { markThreadsForRefetch, saveEmail } from "../../db/queries/email-retention.server";
import { linkEmail, markLinksViewed, setCategory, unlinkedStageEmails } from "../../db/queries/email-sync.server";
import { updateSyncState } from "../../db/queries/gmail-sync.server";
import { applicationsFor, latestStageEmailPerApplication, setApplicationStatus } from "../../db/queries/status.server";
import { insertUsage, usageRows } from "../../db/queries/usage.server";
import type { Classification } from "../../email/classify/index.server";
import type { StageUsage } from "../../jev/email-stage.server";
import { clearBookmarkOnApply } from "../../services/status/rules";
import type { GmailMessage } from "../mapping.server";
import type { CategoryChange, Fetched, Plan, ReclassifiableEmail, Run } from "./run";
import { MAX_LOOKBACK_MS } from "./run";

export function changedCategories(stored: ReclassifiableEmail[], classifications: Map<string, Classification>) {
  return stored.flatMap((email): CategoryChange[] => {
    const next = classifications.get(email.id);
    if (!next || (next.category === email.category && next.confidence === email.confidence)) return [];
    return [{ id: email.id, ...next }];
  });
}

export async function saveAndLoadForMatching(
  db: Db,
  run: Run,
  fetched: Fetched,
  classifications: Map<string, Classification>,
  categoryChanges: CategoryChange[],
) {
  const rows = toEmailRows(run.userId, fetched.messages, fetched.missing, classifications);
  const savedIds = new Set(rows.map((r) => r.id));
  const importedNowSaved = run.importedLinkIds.filter((id) => savedIds.has(id));
  const writes = [
    ...rows.map((row) => saveEmail(db, row)),
    ...categoryChanges.map((change) => setCategory(db, run.userId, change)),
    ...chunk(importedNowSaved, MAX_IDS_PER_STATEMENT).map((ids) => markLinksViewed(db, run.userId, ids, run.startedAt)),
  ];
  const matched = run.applicationsChanged || writes.length > 0;
  if (!matched) return { matched, unlinked: [], applications: [], latestStages: [] };

  const unlinkedQuery = unlinkedStageEmails(db, run.userId, Math.min(run.since, Date.now() - MAX_LOOKBACK_MS));
  const applicationsQuery = applicationsFor(db, run.userId);
  const latestStagesQuery = latestStageEmailPerApplication(db, run.userId, run.settings.minConfidence);

  const results = await db.batch(
    asBatch([
      ...writes,
      unlinkedQuery,
      applicationsQuery,
      latestStagesQuery,
    ]),
  );
  const [unlinked, applications, latestStages] = results.slice(-3) as [
    Awaited<typeof unlinkedQuery>,
    Awaited<typeof applicationsQuery>,
    Awaited<typeof latestStagesQuery>,
  ];
  return { matched, unlinked, applications, latestStages };
}

export async function finishRun(
  db: Db,
  run: Run,
  plan: Plan,
  fetched: Fetched,
  usage: StageUsage[],
  reclassifyComplete: boolean,
  jobEmailIds: string[],
  matched: boolean,
) {
  const classifierUpToDate = run.classifier === run.previousClassifier || (run.needsReclassify && reclassifyComplete);
  await db.batch(
    asBatch([
      ...usageRows(run.userId, usage, run.startedAt).map((row) => insertUsage(db, row)),
      ...plan.links.map((link) => linkEmail(db, run.userId, link.emailId, link.applicationId)),
      ...chunk(jobEmailIds, MAX_IDS_PER_STATEMENT).map((ids) => markThreadsForRefetch(db, run.userId, ids)),
      ...plan.statusChanges.map((change) =>
        setApplicationStatus(
          db,
          run.userId,
          change.applicationId,
          clearBookmarkOnApply(change.from, { status: change.status, updatedAt: run.startedAt }),
        ),
      ),
      updateSyncState(db, run.userId, {
        lastError: null,
        hasMore: fetched.more || fetched.moreToFetchAgain,
        classifier: classifierUpToDate ? run.classifier : run.previousClassifier,
        stage: "reviewing",
        stageCount: null,
        lastFetched: fetched.messages.length,
        lastLinked: plan.links.length,
        ...(fetched.more ? {} : { syncedThrough: run.startedAt }),
        ...(matched ? { matchedAt: run.startedAt } : {}),
      }),
    ]),
  );
  if (plan.links.length) await invalidate(UNREAD_COUNTS_CACHE, run.userId);
  if (plan.statusChanges.length) await invalidate(ANALYTICS_CACHE, run.userId);
}

function toEmailRows(
  userId: string,
  messages: GmailMessage[],
  deletedIds: string[],
  classifications: Map<string, Classification>,
) {
  const received = messages.map((m) => ({
    userId,
    id: m.id,
    threadId: m.threadId,
    ...classifications.get(m.id)!,
    subject: m.subject,
    snippet: m.snippet,
    fromName: m.fromName,
    fromAddress: m.fromAddress,
    receivedAt: m.receivedAt,
  }));
  const deleted = deletedIds.map((id) => ({ userId, id, category: "deleted", receivedAt: "" }));
  return [...received, ...deleted];
}
