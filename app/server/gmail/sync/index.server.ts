import type { SyncResult } from "~/types/gmail";
import { createAuth } from "../../auth/config.server";
import { asBatch } from "../../db/batch.server";
import { getDb, type Db } from "../../db/client.server";
import { activityInserts, type NewActivity } from "../../db/queries/activity.server";
import { earliestApplication } from "../../db/queries/applications.server";
import { importedLinksMissingDetails, storedEmails } from "../../db/queries/email-sync.server";
import { claimRun, gmailAccountFor, setStage, updateSyncState } from "../../db/queries/gmail-sync.server";
import { settingsRowFor, withDefaults } from "../../db/queries/settings.server";
import { dollars, monthStart, tokensSince } from "../../db/queries/usage.server";
import { activeClassifier, classifyEmails } from "../../email/classify/index.server";
import { pruneAfterRun } from "../../email/retention.server";
import { refreshApplicationStatus } from "../../services/status/refresh.server";
import type { StatusChange } from "../../services/status/rules";
import { GmailAuthError, getMessageBodies } from "../client.server";
import { extractPendingDetails, suggestUntrackedApplications } from "./enrich.server";
import { fetchNewMessages, searchWindowStart, withSentByUser } from "./fetch.server";
import { changedCategories, finishRun, saveAndLoadForMatching } from "./persist.server";
import { planLinksAndStatuses } from "./plan.server";
import { AUTH_ERROR, AUTO_SYNC_EVERY_MS, isRecent, MIN_GAP_BETWEEN_RUNS_MS, type Plan, type Run } from "./run";

const RETRY_ERROR = "Gmail sync failed. It will retry automatically.";

export type SyncTrigger = "auto" | "manual";

export async function syncGmail(env: Env, userId: string, trigger: SyncTrigger): Promise<SyncResult> {
  const db = getDb(env.DB);
  const run = await startRun(db, env, userId, trigger);
  if (!run) return { fetched: 0, linked: 0, more: false, busy: true };

  try {
    if (!run.accountId) throw new GmailAuthError("Gmail not connected");
    const token = await getAccessToken(env, run.userId, run.accountId);
    const [fetched, stored] = await Promise.all([
      fetchNewMessages(token, db, run),
      run.needsReclassify ? storedEmails(db, userId) : [],
    ]);

    const toClassify = await withSentByUser(token, fetched.messages, stored);
    if (toClassify.length) await setStage(db, userId, "classifying", toClassify.length);
    const { classifications, usage, fellBack } = await classifyEmails(
      env,
      toClassify,
      (ids) => getMessageBodies(token, ids),
      {
        useJev: run.useJev,
        minConfidence: run.settings.minConfidence,
        readBodies: run.settings.readBodies,
      },
    );
    const reclassified = stored.filter((e) => !fellBack.has(e.id));
    const categoryChanges = changedCategories(reclassified, classifications);
    const reclassifyComplete = reclassified.length === stored.length;

    const { unlinked, applications, latestStages } = await saveAndLoadForMatching(
      db,
      run,
      fetched,
      classifications,
      categoryChanges,
    );
    const plan = planLinksAndStatuses(unlinked, applications, latestStages, run.settings.minConfidence);
    await finishRun(db, run, plan, fetched, usage, reclassifyComplete);
    const reclassifiedStatuses = categoryChanges.length ? await refreshApplicationStatus(db, userId) : [];
    const details = await extractPendingDetails(env, db, run, token).catch((e) => {
      console.error("email details failed", e);
      return [];
    });
    const suggestions = await suggestUntrackedApplications(env, db, run, token).catch((e) => {
      console.error("suggestions failed", e);
      return [];
    });
    // Last, once matching, suggestions and details have had their look: clear
    // what's left that isn't about jobs.
    await pruneAfterRun(db, run.userId, run.classifier, fellBack);
    await completeRun(db, run.userId, [
      ...plan.links.filter((link) => isRecent(link.receivedAt)).map(linkActivity),
      ...plan.statusChanges.map(({ applicationId, from, status }) =>
        statusActivity({ applicationId, from, to: status }),
      ),
      ...reclassifiedStatuses.map(statusActivity),
      ...details,
      ...suggestions,
    ]);
    return { fetched: fetched.messages.length, linked: plan.links.length, more: fetched.more };
  } catch (e) {
    return failRun(db, userId, e);
  }
}

async function completeRun(db: Db, userId: string, activities: NewActivity[]) {
  const finishedAt = new Date().toISOString();
  await db.batch(
    asBatch([
      ...activityInserts(db, userId, activities, finishedAt),
      updateSyncState(db, userId, { stage: null, stageCount: null, lastFinishedAt: finishedAt }),
    ]),
  );
}

function linkActivity(link: Plan["links"][number]): NewActivity {
  return {
    kind: "email",
    applicationId: link.applicationId,
    emailId: link.emailId,
    detail: { category: link.category },
  };
}

function statusActivity({ applicationId, from, to }: StatusChange): NewActivity {
  return { kind: "status", applicationId, detail: { from, to } };
}

async function startRun(db: Db, env: Env, userId: string, trigger: SyncTrigger): Promise<Run | null> {
  const startedAt = new Date().toISOString();
  const [claimed, [gmailAccount], importedLinks, [firstApplication], [settingsRow], [spent]] = await db.batch([
    claimRun(db, userId, startedAt, MIN_GAP_BETWEEN_RUNS_MS, trigger === "manual" ? null : AUTO_SYNC_EVERY_MS),
    gmailAccountFor(db, userId),
    importedLinksMissingDetails(db, userId),
    earliestApplication(db, userId),
    settingsRowFor(db, userId),
    tokensSince(db, userId, monthStart()),
  ]);
  if (!claimed.length) return null;

  const settings = withDefaults(settingsRow);
  const classifier = activeClassifier(env, settings);
  const wantsJev = classifier.startsWith("jev");
  const overBudget = settings.monthlyBudget !== null && dollars(Number(spent?.tokens ?? 0)) >= settings.monthlyBudget;
  const useJev = wantsJev && !overBudget;
  const classifierChanged = claimed[0].classifier !== classifier;
  const needsReclassify = classifierChanged && (useJev || !wantsJev);

  return {
    userId,
    startedAt,
    accountId: gmailAccount?.id ?? null,
    since: searchWindowStart(claimed[0].syncedThrough, firstApplication?.appliedAt),
    importedLinkIds: importedLinks.map((l) => l.id),
    settings,
    useJev,
    needsReclassify,
    classifier,
    previousClassifier: claimed[0].classifier,
  };
}

async function failRun(db: Db, userId: string, e: unknown): Promise<SyncResult> {
  const isAuth = e instanceof GmailAuthError;
  if (isAuth) console.warn(`gmail auth failed for ${userId}: ${e.message}`);
  else console.error("gmail sync failed", e);

  const error = isAuth ? AUTH_ERROR : RETRY_ERROR;
  await updateSyncState(db, userId, {
    lastError: error,
    stage: null,
    stageCount: null,
    lastFinishedAt: new Date().toISOString(),
  });
  return { fetched: 0, linked: 0, more: true, error };
}

async function getAccessToken(env: Env, userId: string, accountId: string) {
  try {
    const { accessToken } = await createAuth(env).api.getAccessToken({ body: { accountId, userId } });
    if (!accessToken) throw new Error("empty token");
    return accessToken;
  } catch (e) {
    throw new GmailAuthError(`token refresh failed (${e instanceof Error ? e.message : e})`);
  }
}
