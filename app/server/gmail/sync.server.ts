import { and, eq, gte, inArray, like, ne, notInArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { fmtAgo } from "~/lib/time";
import { createAuth } from "../auth.server";
import { getDb, type Db } from "../db/client.server";
import { account, application, emailLink, emailMessage, gmailSync } from "../db/schema";
import { CLASSIFIER_VERSION, classifyEmail } from "../email/classify.server";
import { GmailAuthError, getMessagesMetadata, listMessageIds, type GmailMessage } from "./api.server";
import { matchApplication } from "./match.server";

const MINUTE = 60_000;
const DAY = 86_400_000;

const AUTO_SYNC_EVERY_MS = 15 * MINUTE;
const MIN_GAP_BETWEEN_RUNS_MS = MINUTE;

const MAX_LIST_PAGES = 4;
const MAX_FETCH_PER_RUN = 150;
const MAX_LOOKBACK_MS = 180 * DAY;
const FIRST_SYNC_LOOKBACK_MS = 90 * DAY;
const LOOKBACK_BEFORE_FIRST_APPLICATION_MS = 14 * DAY;
const LATE_DELIVERY_OVERLAP_MS = DAY;
const MAX_IDS_PER_UPDATE = 90;

const LOCKED_STATUSES = new Set(["accepted", "withdrawn"]);
const NON_STAGE_CATEGORIES = ["other", "applied", "deleted"];

const AUTH_ERROR = "Gmail access expired or was revoked. Reconnect Gmail in your profile.";
const RETRY_ERROR = "Gmail sync failed. It will retry automatically.";

const JOB_EMAIL_SEARCH =
  "-in:sent -in:drafts -in:chats " +
  '{application applied applying applicant candidate candidacy interview assessment offer unfortunately "next steps" ' +
  'recruiter recruiting hiring "coding challenge" "take-home" hackerrank codility codesignal hirevue testgorilla}';

export type SyncTrigger = "auto" | "manual";

export interface SyncResult {
  fetched: number;
  linked: number;
  more: boolean;
  busy?: boolean;
  error?: string;
}

export interface GmailStatus {
  connected: boolean;
  lastRunAt: string | null;
  lastSynced: string | null;
  lastError: string | null;
  hasMore: boolean;
}

interface Run {
  userId: string;
  startedAt: string;
  accountId: string | null;
  since: number;
  importedLinkIds: string[];
  needsReclassify: boolean;
}

interface Fetched {
  messages: GmailMessage[];
  missing: string[];
  more: boolean;
}

interface CategoryChange {
  id: string;
  category: string;
}

interface Plan {
  links: { emailId: string; applicationId: string }[];
  statusChanges: { applicationId: string; status: string }[];
}

type StoredEmail = typeof emailMessage.$inferSelect;
type TrackedApplication = Awaited<ReturnType<typeof applicationsFor>>[number];
type LatestStage = Awaited<ReturnType<typeof latestStageEmailPerApplication>>[number];

const isGmailAccount = and(eq(account.providerId, "google"), like(account.scope, `%${GMAIL_SCOPE}%`));

export async function getGmailStatus(db: Db, userId: string): Promise<GmailStatus> {
  const [row] = await db
    .select({ lastRunAt: gmailSync.lastRunAt, lastError: gmailSync.lastError, hasMore: gmailSync.hasMore })
    .from(account)
    .leftJoin(gmailSync, eq(gmailSync.userId, account.userId))
    .where(and(eq(account.userId, userId), isGmailAccount))
    .limit(1);
  const lastRunAt = row?.lastRunAt ?? null;
  return {
    connected: !!row,
    lastRunAt,
    lastSynced: lastRunAt ? fmtAgo(lastRunAt) : null,
    lastError: row?.lastError ?? null,
    hasMore: row?.hasMore ?? false,
  };
}

export function syncGmailInBackground(env: Env, ctx: ExecutionContext, userId: string, status: GmailStatus) {
  if (!status.connected) return;
  const sinceLastRun = status.lastRunAt ? Date.now() - Date.parse(status.lastRunAt) : Infinity;
  const interval = status.hasMore ? MIN_GAP_BETWEEN_RUNS_MS : AUTO_SYNC_EVERY_MS;
  if (sinceLastRun >= interval) ctx.waitUntil(syncGmail(env, userId, "auto"));
}

export async function syncAllGmailUsers(env: Env) {
  const db = getDb(env.DB);
  const users = await db.selectDistinct({ userId: account.userId }).from(account).where(isGmailAccount);
  for (const { userId } of users) await syncGmail(env, userId, "auto");
}

export async function syncGmail(env: Env, userId: string, trigger: SyncTrigger): Promise<SyncResult> {
  const db = getDb(env.DB);
  const run = await startRun(db, userId, trigger);
  if (!run) return { fetched: 0, linked: 0, more: false, busy: true };

  try {
    const [fetched, categoryChanges] = await Promise.all([
      fetchNewMessages(env, db, run),
      run.needsReclassify ? reclassifyStoredEmails(db, userId) : [],
    ]);
    const { unlinked, applications, latestStages } = await saveAndLoadForMatching(db, run, fetched, categoryChanges);
    const plan = planLinksAndStatuses(unlinked, applications, latestStages, categoryChanges.length > 0);
    await finishRun(db, run, plan, fetched.more);
    return { fetched: fetched.messages.length, linked: plan.links.length, more: fetched.more };
  } catch (e) {
    return failRun(db, userId, e);
  }
}

async function startRun(db: Db, userId: string, trigger: SyncTrigger): Promise<Run | null> {
  const startedAt = new Date().toISOString();
  const [claimed, [gmailAccount], importedLinks, [firstApplication]] = await db.batch([
    claimRun(db, userId, trigger, startedAt),
    gmailAccountFor(db, userId),
    importedLinksMissingDetails(db, userId),
    earliestApplication(db, userId),
  ]);
  if (!claimed.length) return null;

  return {
    userId,
    startedAt,
    accountId: gmailAccount?.id ?? null,
    since: searchWindowStart(claimed[0].syncedThrough, firstApplication?.appliedAt),
    importedLinkIds: importedLinks.map((l) => l.id),
    needsReclassify: claimed[0].classifierVersion < CLASSIFIER_VERSION,
  };
}

async function fetchNewMessages(env: Env, db: Db, run: Run): Promise<Fetched> {
  if (!run.accountId) throw new GmailAuthError("Gmail not connected");

  const [token, storedIds] = await Promise.all([
    getAccessToken(env, run.userId, run.accountId),
    storedEmailIdsSince(db, run.userId, run.since - LATE_DELIVERY_OVERLAP_MS),
  ]);
  const listed = await listMessageIds(token, `after:${Math.floor(run.since / 1000)} ${JOB_EMAIL_SEARCH}`, MAX_LIST_PAGES);

  const known = new Set(storedIds.map((r) => r.id));
  const unseenOldestFirst = listed.ids.filter((id) => !known.has(id)).reverse();
  const queue = [...new Set([...run.importedLinkIds, ...unseenOldestFirst])];
  const thisRun = queue.slice(0, MAX_FETCH_PER_RUN);

  const { messages, missing, failed } = await getMessagesMetadata(token, thisRun);
  return { messages, missing, more: failed.length > 0 || queue.length > thisRun.length };
}

async function reclassifyStoredEmails(db: Db, userId: string): Promise<CategoryChange[]> {
  const stored = await db
    .select({ id: emailMessage.id, category: emailMessage.category, subject: emailMessage.subject, snippet: emailMessage.snippet })
    .from(emailMessage)
    .where(and(eq(emailMessage.userId, userId), ne(emailMessage.category, "deleted")));

  return stored.flatMap((email) => {
    const category = classifyEmail({ subject: email.subject, body: email.snippet });
    return category === email.category ? [] : [{ id: email.id, category }];
  });
}

async function saveAndLoadForMatching(db: Db, run: Run, fetched: Fetched, categoryChanges: CategoryChange[]) {
  const rows = toEmailRows(run.userId, fetched.messages, fetched.missing);
  const savedIds = new Set(rows.map((r) => r.id));
  const importedNowSaved = run.importedLinkIds.filter((id) => savedIds.has(id));

  const unlinkedQuery = unlinkedStageEmails(db, run.userId, Math.min(run.since, Date.now() - MAX_LOOKBACK_MS));
  const applicationsQuery = applicationsFor(db, run.userId);
  const latestStagesQuery = latestStageEmailPerApplication(db, run.userId);

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

async function finishRun(db: Db, run: Run, plan: Plan, more: boolean) {
  await db.batch(
    asBatch([
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
          hasMore: more,
          classifierVersion: CLASSIFIER_VERSION,
          ...(more ? {} : { syncedThrough: run.startedAt }),
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
  await db.update(gmailSync).set({ lastError: error }).where(eq(gmailSync.userId, userId));
  return { fetched: 0, linked: 0, more: true, error };
}

function planLinksAndStatuses(
  unlinked: StoredEmail[],
  applications: TrackedApplication[],
  latestStages: LatestStage[],
  recheckEveryStatus: boolean,
): Plan {
  const latestByApplication = new Map(latestStages.map((stage) => [stage.applicationId, stage]));
  const needsStatusCheck = new Set(recheckEveryStatus ? applications.map((a) => a.id) : []);
  const links: Plan["links"] = [];

  for (const email of unlinked) {
    const candidates = applicationsStillOpenFor(email, applications, latestByApplication);
    const match = matchApplication(email, candidates);
    if (!match) continue;

    links.push({ emailId: email.id, applicationId: match.id });
    if (NON_STAGE_CATEGORIES.includes(email.category)) continue;

    const current = latestByApplication.get(match.id);
    if (!current || email.receivedAt > current.receivedAt) {
      latestByApplication.set(match.id, { applicationId: match.id, category: email.category, receivedAt: email.receivedAt });
    }
    needsStatusCheck.add(match.id);
  }

  const statusChanges = applications.flatMap((app) => {
    const latest = needsStatusCheck.has(app.id) ? latestByApplication.get(app.id) : undefined;
    return latest && shouldFollowEmail(app, latest) ? [{ applicationId: app.id, status: latest.category }] : [];
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

function toEmailRows(userId: string, messages: GmailMessage[], deletedIds: string[]) {
  const received = messages.map((m) => ({
    userId,
    id: m.id,
    threadId: m.threadId,
    category: classifyEmail({ subject: m.subject, body: m.snippet }),
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
    .values({ userId, lastRunAt: startedAt })
    .onConflictDoUpdate({
      target: gmailSync.userId,
      set: { lastRunAt: startedAt },
      setWhere: sql`${gmailSync.lastRunAt} is null or (${due})`,
    })
    .returning({ syncedThrough: gmailSync.syncedThrough, classifierVersion: gmailSync.classifierVersion });
}

function gmailAccountFor(db: Db, userId: string) {
  return db.select({ id: account.id }).from(account).where(and(eq(account.userId, userId), isGmailAccount)).limit(1);
}

function importedLinksMissingDetails(db: Db, userId: string) {
  return db
    .selectDistinct({ id: emailLink.id })
    .from(emailLink)
    .leftJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(and(eq(emailLink.userId, userId), sql`${emailMessage.id} is null`));
}

function earliestApplication(db: Db, userId: string) {
  return db
    .select({ appliedAt: application.appliedAt })
    .from(application)
    .where(eq(application.userId, userId))
    .orderBy(application.appliedAt)
    .limit(1);
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

function applicationsFor(db: Db, userId: string) {
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
    .where(eq(application.userId, userId));
}

function latestStageEmailPerApplication(db: Db, userId: string) {
  return db
    .select({
      applicationId: emailLink.applicationId,
      category: emailMessage.category,
      receivedAt: sql<string>`max(${emailMessage.receivedAt})`,
    })
    .from(emailLink)
    .innerJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .where(and(eq(emailLink.userId, userId), notInArray(emailMessage.category, NON_STAGE_CATEGORIES)))
    .groupBy(emailLink.applicationId);
}

function setCategory(db: Db, userId: string, change: CategoryChange) {
  return db
    .update(emailMessage)
    .set({ category: change.category })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, change.id)));
}

function markLinksViewed(db: Db, userId: string, ids: string[], viewedAt: string) {
  return db
    .update(emailLink)
    .set({ viewedAt })
    .where(and(eq(emailLink.userId, userId), inArray(emailLink.id, ids), sql`${emailLink.viewedAt} is null`));
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function asBatch(items: BatchItem<"sqlite">[]) {
  return items as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
}
