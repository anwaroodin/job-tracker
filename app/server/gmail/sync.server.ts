import { and, desc, eq, gte, inArray, isNotNull, isNull, like, ne, notInArray, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { chunk } from "~/lib/array";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { createAuth } from "../auth.server";
import { getDb, type Db } from "../db/client.server";
import { account, application, emailLink, emailMessage, gmailSync, jevUsage, userSettings } from "../db/schema";
import { activityInserts, unseenActivityCount, type NewActivity } from "../db/activity.server";
import { settingsRowFor, withDefaults } from "../db/settings.server";
import { dollars, monthStart, tokensSince, usageRows } from "../db/usage.server";
import {
  activeClassifier,
  classifyEmails,
  isConfident,
  type ClassifiableEmail,
  type Classification,
} from "../email/classifier.server";
import type { StageUsage } from "../jev/email-stage.server";
import { findDates, findLinks } from "../email/details.server";
import { extractDetailsWithJev } from "../jev/email-details.server";
import { MIN_APPLICATION_PROBABILITY, suggestionCandidates, SUGGESTION_LOOKBACK_MS } from "../email/suggestions.server";
import { suggestApplicationsWithJev, suggestWithoutJev } from "../jev/application-suggestion.server";
import { APPLICATION_CATEGORIES, DETAIL_CATEGORIES, NEEDS_REPLY_PROBABILITY } from "~/lib/email";
import type { Settings } from "~/lib/settings";
import {
  GmailAuthError,
  getMailboxAddress,
  getMessageBodies,
  getMessagesMetadata,
  listMessageIds,
  type GmailMessage,
} from "./api.server";
import { matchApplication } from "./match.server";

const MINUTE = 60_000;
const DAY = 86_400_000;

const AUTO_SYNC_EVERY_MS = 15 * MINUTE;
const MIN_GAP_BETWEEN_RUNS_MS = MINUTE;
const STUCK_RUN_MS = 2 * MINUTE;
const RECENT_FOR_ACTIVITY_MS = 7 * DAY;

const MAX_LIST_PAGES = 4;
const MAX_FETCH_PER_RUN = 150;
const MAX_LOOKBACK_MS = 180 * DAY;
const FIRST_SYNC_LOOKBACK_MS = 90 * DAY;
const LOOKBACK_BEFORE_FIRST_APPLICATION_MS = 14 * DAY;
const LATE_DELIVERY_OVERLAP_MS = DAY;
const MAX_IDS_PER_UPDATE = 90;
const DETAILS_PER_RUN = 20;
const DETAILS_LOOKBACK_MS = 60 * DAY;
const SUGGESTIONS_PER_RUN = 25;

const LOCKED_STATUSES = new Set(["accepted", "withdrawn"]);
const NON_STAGE_CATEGORIES = ["other", "applied", "deleted"];

const AUTH_ERROR = "Gmail access expired or was revoked. Reconnect Gmail in your profile.";
const RETRY_ERROR = "Gmail sync failed. It will retry automatically.";

const JOB_EMAIL_SEARCH =
  "-in:sent -in:drafts -in:chats " +
  '{application applied applying applicant candidate candidacy interview assessment offer unfortunately "next steps" ' +
  'recruiter recruiting hiring "coding challenge" "take-home" hackerrank codility codesignal hirevue testgorilla}';

export type SyncTrigger = "auto" | "manual";
export type SyncStage = "checking" | "downloading" | "classifying" | "reviewing";

export interface SyncResult {
  fetched: number;
  linked: number;
  more: boolean;
  busy?: boolean;
  error?: string;
}

export interface GmailStatus {
  connected: boolean;
  syncing: boolean;
  stage: SyncStage | null;
  stageCount: number | null;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  needsReconnect: boolean;
  lastFetched: number | null;
  lastLinked: number | null;
  hasMore: boolean;
  autoSync: boolean;
  unseenActivity: number;
}

interface Run {
  userId: string;
  startedAt: string;
  accountId: string | null;
  since: number;
  importedLinkIds: string[];
  settings: Settings;
  useJev: boolean;
  needsReclassify: boolean;
  classifier: string;
  previousClassifier: string | null;
}

interface Fetched {
  messages: GmailMessage[];
  missing: string[];
  more: boolean;
}

interface CategoryChange extends Classification {
  id: string;
}

interface Plan {
  links: { emailId: string; applicationId: string; category: string; receivedAt: string }[];
  statusChanges: { applicationId: string; status: string; from: string }[];
}

interface StatusChange {
  applicationId: string;
  from: string;
  to: string;
}

type StoredEmail = typeof emailMessage.$inferSelect;
type ReclassifiableEmail = Awaited<ReturnType<typeof storedEmails>>[number];
type TrackedApplication = Awaited<ReturnType<typeof applicationsFor>>[number];
type LatestStage = Awaited<ReturnType<typeof latestStageEmailPerApplication>>[number];

const isGmailAccount = and(eq(account.providerId, "google"), like(account.scope, `%${GMAIL_SCOPE}%`));

export async function getGmailStatus(db: Db, userId: string): Promise<GmailStatus> {
  const [[row], [unseen]] = await db.batch([
    db
      .select({
        lastRunAt: gmailSync.lastRunAt,
        lastError: gmailSync.lastError,
        hasMore: gmailSync.hasMore,
        stage: gmailSync.stage,
        stageCount: gmailSync.stageCount,
        lastFetched: gmailSync.lastFetched,
        lastLinked: gmailSync.lastLinked,
        autoSync: userSettings.autoSync,
        lastFinishedAt: gmailSync.lastFinishedAt,
      })
      .from(account)
      .leftJoin(gmailSync, eq(gmailSync.userId, account.userId))
      .leftJoin(userSettings, eq(userSettings.userId, account.userId))
      .where(and(eq(account.userId, userId), isGmailAccount))
      .limit(1),
    unseenActivityCount(db, userId),
  ]);
  const lastRunAt = row?.lastRunAt ?? null;
  const runIsLive = !!lastRunAt && Date.now() - Date.parse(lastRunAt) < STUCK_RUN_MS;
  const stage = runIsLive ? ((row?.stage as SyncStage | null) ?? null) : null;
  return {
    connected: !!row,
    syncing: !!stage,
    stage,
    stageCount: stage ? (row?.stageCount ?? null) : null,
    lastRunAt,
    lastFinishedAt: row?.lastFinishedAt ?? null,
    lastError: row?.lastError ?? null,
    needsReconnect: row?.lastError === AUTH_ERROR,
    lastFetched: row?.lastFetched ?? null,
    lastLinked: row?.lastLinked ?? null,
    hasMore: row?.hasMore ?? false,
    autoSync: row?.autoSync ?? true,
    unseenActivity: Number(unseen?.count ?? 0),
  };
}

export function syncGmailInBackground(env: Env, ctx: ExecutionContext, userId: string, status: GmailStatus) {
  if (!status.connected || status.syncing || !status.autoSync) return false;
  const sinceLastRun = status.lastRunAt ? Date.now() - Date.parse(status.lastRunAt) : Infinity;
  const interval = status.hasMore ? MIN_GAP_BETWEEN_RUNS_MS : AUTO_SYNC_EVERY_MS;
  if (sinceLastRun < interval) return false;
  ctx.waitUntil(syncGmail(env, userId, "auto"));
  return true;
}

export async function syncAllGmailUsers(env: Env) {
  const db = getDb(env.DB);
  const users = await db
    .selectDistinct({ userId: account.userId })
    .from(account)
    .leftJoin(userSettings, eq(userSettings.userId, account.userId))
    .where(and(isGmailAccount, or(isNull(userSettings.autoSync), eq(userSettings.autoSync, true))));
  for (const { userId } of users) await syncGmail(env, userId, "auto");
}

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
      db
        .update(gmailSync)
        .set({ stage: null, stageCount: null, lastFinishedAt: finishedAt })
        .where(eq(gmailSync.userId, userId)),
    ]),
  );
}

function isRecent(receivedAt: string) {
  return Date.now() - Date.parse(receivedAt) < RECENT_FOR_ACTIVITY_MS;
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
    claimRun(db, userId, trigger, startedAt),
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

async function fetchNewMessages(token: string, db: Db, run: Run): Promise<Fetched> {
  const [storedIds, listed] = await Promise.all([
    storedEmailIdsSince(db, run.userId, run.since - LATE_DELIVERY_OVERLAP_MS),
    listMessageIds(token, `after:${Math.floor(run.since / 1000)} ${JOB_EMAIL_SEARCH}`, MAX_LIST_PAGES),
  ]);

  const known = new Set(storedIds.map((r) => r.id));
  const unseenOldestFirst = listed.ids.filter((id) => !known.has(id)).reverse();
  const queue = [...new Set([...run.importedLinkIds, ...unseenOldestFirst])];
  const thisRun = queue.slice(0, MAX_FETCH_PER_RUN);

  if (thisRun.length) await setStage(db, run.userId, "downloading", thisRun.length);
  const { messages, missing, failed } = await getMessagesMetadata(token, thisRun);
  return { messages, missing, more: failed.length > 0 || queue.length > thisRun.length };
}

async function withSentByUser(
  token: string,
  messages: GmailMessage[],
  stored: ReclassifiableEmail[],
): Promise<ClassifiableEmail[]> {
  if (!messages.length && !stored.length) return [];
  const mailbox = await getMailboxAddress(token).catch(() => "");
  return [
    ...messages.map((m) => ({ ...m, sentByUser: m.sent || m.fromAddress === mailbox })),
    ...stored.map((e) => ({ ...e, sentByUser: e.fromAddress === mailbox })),
  ];
}

function changedCategories(stored: ReclassifiableEmail[], classifications: Map<string, Classification>) {
  return stored.flatMap((email): CategoryChange[] => {
    const next = classifications.get(email.id);
    if (!next || (next.category === email.category && next.confidence === email.confidence)) return [];
    return [{ id: email.id, ...next }];
  });
}

async function saveAndLoadForMatching(
  db: Db,
  run: Run,
  fetched: Fetched,
  classifications: Map<string, Classification>,
  categoryChanges: CategoryChange[],
) {
  const rows = toEmailRows(run.userId, fetched.messages, fetched.missing, classifications);
  const savedIds = new Set(rows.map((r) => r.id));
  const importedNowSaved = run.importedLinkIds.filter((id) => savedIds.has(id));

  const unlinkedQuery = unlinkedStageEmails(db, run.userId, Math.min(run.since, Date.now() - MAX_LOOKBACK_MS));
  const applicationsQuery = applicationsFor(db, run.userId);
  const latestStagesQuery = latestStageEmailPerApplication(db, run.userId, run.settings.minConfidence);

  const results = await db.batch(
    asBatch([
      ...rows.map((row) => db.insert(emailMessage).values(row).onConflictDoNothing()),
      ...categoryChanges.map((change) => setCategory(db, run.userId, change)),
      ...chunk(importedNowSaved, MAX_IDS_PER_UPDATE).map((ids) => markLinksViewed(db, run.userId, ids, run.startedAt)),
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
  return { unlinked, applications, latestStages };
}

async function finishRun(
  db: Db,
  run: Run,
  plan: Plan,
  fetched: Fetched,
  usage: StageUsage[],
  reclassifyComplete: boolean,
) {
  const classifierUpToDate = run.classifier === run.previousClassifier || (run.needsReclassify && reclassifyComplete);
  await db.batch(
    asBatch([
      ...usageRows(run.userId, usage, run.startedAt).map((row) => db.insert(jevUsage).values(row)),
      ...plan.links.map((link) =>
        db
          .insert(emailLink)
          .values({ id: link.emailId, applicationId: link.applicationId, userId: run.userId })
          .onConflictDoNothing(),
      ),
      ...plan.statusChanges.map((change) =>
        db
          .update(application)
          .set({ status: change.status, updatedAt: run.startedAt })
          .where(and(eq(application.id, change.applicationId), eq(application.userId, run.userId))),
      ),
      db
        .update(gmailSync)
        .set({
          lastError: null,
          hasMore: fetched.more,
          classifier: classifierUpToDate ? run.classifier : run.previousClassifier,
          stage: "reviewing",
          stageCount: null,
          lastFetched: fetched.messages.length,
          lastLinked: plan.links.length,
          ...(fetched.more ? {} : { syncedThrough: run.startedAt }),
        })
        .where(eq(gmailSync.userId, run.userId)),
    ]),
  );
}

async function failRun(db: Db, userId: string, e: unknown): Promise<SyncResult> {
  const isAuth = e instanceof GmailAuthError;
  if (isAuth) console.warn(`gmail auth failed for ${userId}: ${e.message}`);
  else console.error("gmail sync failed", e);

  const error = isAuth ? AUTH_ERROR : RETRY_ERROR;
  await db
    .update(gmailSync)
    .set({ lastError: error, stage: null, stageCount: null, lastFinishedAt: new Date().toISOString() })
    .where(eq(gmailSync.userId, userId));
  return { fetched: 0, linked: 0, more: true, error };
}

function planLinksAndStatuses(
  unlinked: StoredEmail[],
  applications: TrackedApplication[],
  latestStages: LatestStage[],
  minConfidence: number,
): Plan {
  const latestByApplication = new Map(latestStages.map((stage) => [stage.applicationId, stage]));
  const needsStatusCheck = new Set<string>();
  const links: Plan["links"] = [];

  for (const email of unlinked) {
    const candidates = applicationsStillOpenFor(email, applications, latestByApplication);
    const match = matchApplication(email, candidates);
    if (!match) continue;

    links.push({ emailId: email.id, applicationId: match.id, category: email.category, receivedAt: email.receivedAt });
    const unsure = !email.manualCategoryAt && !isConfident(email.confidence, minConfidence);
    if (NON_STAGE_CATEGORIES.includes(email.category) || unsure) continue;

    const current = latestByApplication.get(match.id);
    if (!current || email.receivedAt > current.receivedAt) {
      latestByApplication.set(match.id, { applicationId: match.id, category: email.category, receivedAt: email.receivedAt });
    }
    needsStatusCheck.add(match.id);
  }

  const statusChanges = applications.flatMap((app) => {
    const latest = needsStatusCheck.has(app.id) ? latestByApplication.get(app.id) : undefined;
    return latest && shouldFollowEmail(app, latest)
      ? [{ applicationId: app.id, status: latest.category, from: app.status }]
      : [];
  });

  return { links, statusChanges };
}

function applicationsStillOpenFor(
  email: StoredEmail,
  applications: TrackedApplication[],
  latestByApplication: Map<string, LatestStage>,
) {
  if (email.category !== "applied") return applications;
  return applications.filter((app) => {
    const latest = latestByApplication.get(app.id);
    const rejectedBeforeThisEmail = latest?.category === "rejected" && latest.receivedAt < email.receivedAt;
    return !rejectedBeforeThisEmail;
  });
}

export async function refreshApplicationStatus(
  db: Db,
  userId: string,
  applicationId?: string,
): Promise<StatusChange[]> {
  const [settingsRow] = await settingsRowFor(db, userId);
  const { minConfidence } = withDefaults(settingsRow);
  const [apps, latestStages, evidence] = await db.batch([
    applicationsFor(db, userId, applicationId),
    latestStageEmailPerApplication(db, userId, minConfidence, applicationId),
    lastStageEvidencePerApplication(db, userId, applicationId),
  ]);
  const latestByApplication = new Map(latestStages.map((stage) => [stage.applicationId, stage]));
  const lastEvidenceAt = new Map(evidence.map((row) => [row.applicationId, row.receivedAt]));
  const updatedAt = new Date().toISOString();

  const changes = apps.flatMap((app): StatusChange[] => {
    const evidenceAt = lastEvidenceAt.get(app.id);
    if (!evidenceAt || LOCKED_STATUSES.has(app.status)) return [];
    const setByHandSinceLastEmail = app.manualStatusAt !== null && app.manualStatusAt >= evidenceAt;
    if (setByHandSinceLastEmail) return [];
    const status = latestByApplication.get(app.id)?.category ?? "applied";
    return status === app.status ? [] : [{ applicationId: app.id, from: app.status, to: status }];
  });
  const updates = changes.map((change) =>
    db
      .update(application)
      .set({ status: change.to, updatedAt })
      .where(and(eq(application.id, change.applicationId), eq(application.userId, userId))),
  );
  if (updates.length) await db.batch(asBatch(updates));
  return changes;
}

async function extractPendingDetails(env: Env, db: Db, run: Run, token: string): Promise<NewActivity[]> {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey || !run.useJev || !run.settings.extractDetails) return [];
  const pending = await emailsNeedingDetails(db, run.userId);
  if (!pending.length) return [];

  const bodies = await getMessageBodies(
    token,
    pending.map((e) => e.id),
  );
  const inputs = pending.map((email) => {
    const body = bodies.get(email.id);
    const text = body?.text || email.snippet;
    return {
      id: email.id,
      category: email.category,
      from: `${email.fromName} <${email.fromAddress}>`,
      subject: email.subject,
      text,
      dates: findDates(text, email.receivedAt),
      links: findLinks(body?.links ?? []),
    };
  });
  const { results, usage } = await extractDetailsWithJev(apiKey, inputs);

  const detailsAt = new Date().toISOString();
  const updates = pending.flatMap((email) => {
    const details = results.get(email.id);
    if (!details) return [];
    return [
      db
        .update(emailMessage)
        .set({ detailsAt, ...details })
        .where(and(eq(emailMessage.userId, run.userId), eq(emailMessage.id, email.id))),
    ];
  });
  const inserts = usageRows(run.userId, usage, detailsAt).map((row) => db.insert(jevUsage).values(row));
  if (updates.length || inserts.length) await db.batch(asBatch([...inserts, ...updates]));

  return pending
    .filter((email) => isRecent(email.receivedAt))
    .flatMap((email): NewActivity[] => {
      const details = results.get(email.id);
      if (!details) return [];
      const base = { applicationId: email.applicationId, emailId: email.id };
      return [
        ...(details.needsReply >= NEEDS_REPLY_PROBABILITY ? [{ ...base, kind: "reply" as const }] : []),
        ...(details.eventAt
          ? [{ ...base, kind: "event" as const, detail: { eventAt: details.eventAt, category: email.category } }]
          : []),
      ];
    });
}

async function suggestUntrackedApplications(env: Env, db: Db, run: Run, token: string): Promise<NewActivity[]> {
  if (!run.settings.suggestApplications) return [];
  const pending = await emailsNeedingSuggestion(db, run.userId);
  if (!pending.length) return [];

  const bodies = await getMessageBodies(
    token,
    pending.map((e) => e.id),
  );
  const inputs = pending.map((email) => {
    const source = {
      subject: email.subject,
      fromName: email.fromName,
      fromAddress: email.fromAddress,
      text: bodies.get(email.id)?.text || email.snippet,
      links: bodies.get(email.id)?.links ?? [],
    };
    return {
      id: email.id,
      from: `${email.fromName} <${email.fromAddress}>`,
      subject: email.subject,
      text: source.text,
      ...suggestionCandidates(source),
    };
  });

  const apiKey = env.TYPESAFE_API_KEY;
  const { results, usage } =
    apiKey && run.useJev
      ? await suggestApplicationsWithJev(apiKey, inputs)
      : { results: new Map(inputs.map((input) => [input.id, suggestWithoutJev(input)])), usage: [] };

  const suggestionAt = new Date().toISOString();
  const updates = pending.flatMap((email) => {
    const result = results.get(email.id);
    if (!result) return [];
    return [
      db
        .update(emailMessage)
        .set({
          suggestionAt,
          isApplication: result.isApplication,
          suggestedCompany: result.company,
          suggestedRole: result.role,
          suggestionConfidence: result.confidence,
        })
        .where(and(eq(emailMessage.userId, run.userId), eq(emailMessage.id, email.id))),
    ];
  });
  const inserts = usageRows(run.userId, usage, suggestionAt).map((row) => db.insert(jevUsage).values(row));
  if (updates.length || inserts.length) await db.batch(asBatch([...inserts, ...updates]));

  return pending
    .filter((email) => isRecent(email.receivedAt))
    .flatMap((email): NewActivity[] => {
      const result = results.get(email.id);
      if (!result || result.isApplication < MIN_APPLICATION_PROBABILITY) return [];
      return [
        {
          kind: "suggestion",
          emailId: email.id,
          detail: { company: result.company, role: result.role, category: email.category },
        },
      ];
    });
}

function emailsNeedingSuggestion(db: Db, userId: string) {
  return db
    .select({
      id: emailMessage.id,
      category: emailMessage.category,
      receivedAt: emailMessage.receivedAt,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        inArray(emailMessage.category, [...APPLICATION_CATEGORIES]),
        isNull(emailMessage.suggestionAt),
        gte(emailMessage.receivedAt, new Date(Date.now() - SUGGESTION_LOOKBACK_MS).toISOString()),
        sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
      ),
    )
    .orderBy(desc(emailMessage.receivedAt))
    .limit(SUGGESTIONS_PER_RUN);
}

function emailsNeedingDetails(db: Db, userId: string) {
  return db
    .select({
      id: emailMessage.id,
      applicationId: sql<string>`(select ${emailLink.applicationId} from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id} and ${emailLink.dismissedAt} is null limit 1)`,
      category: emailMessage.category,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
      receivedAt: emailMessage.receivedAt,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        inArray(emailMessage.category, [...DETAIL_CATEGORIES]),
        isNull(emailMessage.detailsAt),
        gte(emailMessage.receivedAt, new Date(Date.now() - DETAILS_LOOKBACK_MS).toISOString()),
        sql`exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id} and ${emailLink.dismissedAt} is null)`,
      ),
    )
    .orderBy(desc(emailMessage.receivedAt))
    .limit(DETAILS_PER_RUN);
}

export async function requestReclassify(db: Db, userId: string) {
  await db.update(gmailSync).set({ classifier: null }).where(eq(gmailSync.userId, userId));
}

function shouldFollowEmail(app: TrackedApplication, latest: LatestStage) {
  if (latest.category === app.status || LOCKED_STATUSES.has(app.status)) return false;
  const setByHandAfterEmail = app.manualStatusAt !== null && latest.receivedAt <= app.manualStatusAt;
  return !setByHandAfterEmail;
}

function searchWindowStart(syncedThrough: string | null, firstAppliedAt: string | undefined) {
  if (syncedThrough) return Date.parse(syncedThrough) - LATE_DELIVERY_OVERLAP_MS;
  if (!firstAppliedAt) return Date.now() - FIRST_SYNC_LOOKBACK_MS;
  return Math.max(Date.parse(firstAppliedAt) - LOOKBACK_BEFORE_FIRST_APPLICATION_MS, Date.now() - MAX_LOOKBACK_MS);
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

async function getAccessToken(env: Env, userId: string, accountId: string) {
  try {
    const { accessToken } = await createAuth(env).api.getAccessToken({ body: { accountId, userId } });
    if (!accessToken) throw new Error("empty token");
    return accessToken;
  } catch (e) {
    throw new GmailAuthError(`token refresh failed (${e instanceof Error ? e.message : e})`);
  }
}

function claimRun(db: Db, userId: string, trigger: SyncTrigger, startedAt: string) {
  const now = Date.parse(startedAt);
  const ranBefore = (ms: number) => sql`${gmailSync.lastRunAt} < ${new Date(now - ms).toISOString()}`;
  const due =
    trigger === "manual"
      ? ranBefore(MIN_GAP_BETWEEN_RUNS_MS)
      : sql`${ranBefore(AUTO_SYNC_EVERY_MS)} or (${gmailSync.hasMore} = 1 and ${ranBefore(MIN_GAP_BETWEEN_RUNS_MS)})`;

  return db
    .insert(gmailSync)
    .values({ userId, lastRunAt: startedAt, stage: "checking" })
    .onConflictDoUpdate({
      target: gmailSync.userId,
      set: { lastRunAt: startedAt, stage: "checking", stageCount: null },
      setWhere: sql`${gmailSync.lastRunAt} is null or (${due})`,
    })
    .returning({ syncedThrough: gmailSync.syncedThrough, classifier: gmailSync.classifier });
}

function gmailAccountFor(db: Db, userId: string) {
  return db.select({ id: account.id }).from(account).where(and(eq(account.userId, userId), isGmailAccount)).limit(1);
}

function importedLinksMissingDetails(db: Db, userId: string) {
  return db
    .selectDistinct({ id: emailLink.id })
    .from(emailLink)
    .leftJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(and(eq(emailLink.userId, userId), isNull(emailLink.dismissedAt), sql`${emailMessage.id} is null`));
}

function earliestApplication(db: Db, userId: string) {
  return db
    .select({ appliedAt: application.appliedAt })
    .from(application)
    .where(eq(application.userId, userId))
    .orderBy(application.appliedAt)
    .limit(1);
}

function storedEmails(db: Db, userId: string) {
  return db
    .select({
      id: emailMessage.id,
      category: emailMessage.category,
      confidence: emailMessage.confidence,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
    })
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        ne(emailMessage.category, "deleted"),
        isNull(emailMessage.manualCategoryAt),
      ),
    );
}

function storedEmailIdsSince(db: Db, userId: string, since: number) {
  return db
    .select({ id: emailMessage.id })
    .from(emailMessage)
    .where(and(eq(emailMessage.userId, userId), gte(emailMessage.receivedAt, new Date(since).toISOString())));
}

function unlinkedStageEmails(db: Db, userId: string, since: number) {
  return db
    .select()
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        gte(emailMessage.receivedAt, new Date(since).toISOString()),
        notInArray(emailMessage.category, ["other", "deleted"]),
        sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
      ),
    )
    .orderBy(emailMessage.receivedAt);
}

function applicationsFor(db: Db, userId: string, applicationId?: string) {
  return db
    .select({
      id: application.id,
      company: application.company,
      role: application.role,
      appliedAt: application.appliedAt,
      status: application.status,
      manualStatusAt: application.manualStatusAt,
    })
    .from(application)
    .where(and(eq(application.userId, userId), applicationId ? eq(application.id, applicationId) : undefined));
}

function lastStageEvidencePerApplication(db: Db, userId: string, applicationId?: string) {
  return db
    .select({ applicationId: emailLink.applicationId, receivedAt: sql<string>`max(${emailMessage.receivedAt})` })
    .from(emailLink)
    .innerJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(
      and(
        eq(emailLink.userId, userId),
        applicationId ? eq(emailLink.applicationId, applicationId) : undefined,
        or(notInArray(emailMessage.category, NON_STAGE_CATEGORIES), isNotNull(emailMessage.manualCategoryAt)),
      ),
    )
    .groupBy(emailLink.applicationId);
}

function latestStageEmailPerApplication(db: Db, userId: string, minConfidence: number, applicationId?: string) {
  return db
    .select({
      applicationId: emailLink.applicationId,
      category: emailMessage.category,
      receivedAt: sql<string>`max(${emailMessage.receivedAt})`,
    })
    .from(emailLink)
    .innerJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(
      and(
        eq(emailLink.userId, userId),
        applicationId ? eq(emailLink.applicationId, applicationId) : undefined,
        isNull(emailLink.dismissedAt),
        notInArray(emailMessage.category, NON_STAGE_CATEGORIES),
        or(
          isNull(emailMessage.confidence),
          gte(emailMessage.confidence, minConfidence),
          isNotNull(emailMessage.manualCategoryAt),
        ),
      ),
    )
    .groupBy(emailLink.applicationId);
}

function setStage(db: Db, userId: string, stage: SyncStage, count: number) {
  return db.update(gmailSync).set({ stage, stageCount: count }).where(eq(gmailSync.userId, userId));
}

function setCategory(db: Db, userId: string, change: CategoryChange) {
  return db
    .update(emailMessage)
    .set({
      category: change.category,
      confidence: change.confidence,
      detailsAt: sql`case when ${emailMessage.category} = ${change.category} then ${emailMessage.detailsAt} else null end`,
    })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, change.id)));
}

function markLinksViewed(db: Db, userId: string, ids: string[], viewedAt: string) {
  return db
    .update(emailLink)
    .set({ viewedAt })
    .where(and(eq(emailLink.userId, userId), inArray(emailLink.id, ids), sql`${emailLink.viewedAt} is null`));
}

function asBatch(items: BatchItem<"sqlite">[]) {
  return items as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
}
