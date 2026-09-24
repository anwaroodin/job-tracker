import { and, desc, eq, gte, like, notInArray, sql } from "drizzle-orm";
import { fmtAgo } from "~/components/molecules/terminal";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { createAuth } from "../auth.server";
import { updateApplication } from "../db/applications.server";
import { getDb, type Db } from "../db/client.server";
import { markViewed } from "../db/emails.server";
import { account, application, emailLink, emailMessage, gmailSync } from "../db/schema";
import { classifyEmail } from "../email/classify.server";
import {
  GmailAuthError,
  getMessagesMetadata,
  listMessageIds,
  type GmailMessage,
} from "./api.server";
import { matchApplication } from "./match.server";

const DAY = 86_400_000;
// free workers get 50 subrequests per invocation. worst case a run is
const MAX_LIST_PAGES = 4;
const MAX_FETCH_PER_RUN = 150;
const MAX_LOOKBACK_DAYS = 180;
const REMATCH_WINDOW_DAYS = 60;
const STALE_AFTER_MS = 15 * 60_000;
const LOCKED_STATUSES = new Set(["accepted", "withdrawn"]);
const NON_STAGE_CATEGORIES = ["other", "applied", "deleted"];

// let gmail do the filtering so we never download newsletters etc
const SEARCH =
  "-in:sent -in:drafts -in:chats " +
  '{application applied applying applicant candidate candidacy interview assessment offer unfortunately "next steps" ' +
  'recruiter recruiting hiring "coding challenge" "take-home" hackerrank codility codesignal hirevue testgorilla}';

export interface SyncResult {
  fetched: number;
  linked: number;
  more: boolean;
  error?: string;
}

export async function getGmailAccount(db: Db, userId: string) {
  const rows = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "google"),
        like(account.scope, `%${GMAIL_SCOPE}%`),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export interface GmailStatus {
  connected: boolean;
  lastRunAt: string | null;
  lastSynced: string | null;
  lastError: string | null;
}

export async function getGmailStatus(db: Db, userId: string): Promise<GmailStatus> {
  const [conn, [state]] = await Promise.all([
    getGmailAccount(db, userId),
    db.select().from(gmailSync).where(eq(gmailSync.userId, userId)).limit(1),
  ]);
  const lastRunAt = state?.lastRunAt ?? null;
  return {
    connected: !!conn,
    lastRunAt,
    lastSynced: lastRunAt ? fmtAgo(lastRunAt) : null,
    lastError: state?.lastError ?? null,
  };
}

export async function syncGmail(env: Env, userId: string): Promise<SyncResult> {
  const db = getDb(env.DB);
  const runStartedAt = new Date().toISOString();
  const [state] = await db.select().from(gmailSync).where(eq(gmailSync.userId, userId)).limit(1);
  await saveState(db, userId, { lastRunAt: runStartedAt });

  try {
    const token = await getAccessToken(env, db, userId);
    const since = await windowStart(db, userId, state?.syncedThrough ?? null);
    const listed = await listMessageIds(
      token,
      `after:${Math.floor(since / 1000)} ${SEARCH}`,
      MAX_LIST_PAGES,
    );

    const known = new Set(
      (
        await db
          .select({ id: emailMessage.id })
          .from(emailMessage)
          .where(
            and(
              eq(emailMessage.userId, userId),
              gte(emailMessage.receivedAt, new Date(since - DAY).toISOString()),
            ),
          )
      ).map((r) => r.id),
    );
    const legacy = await unhydratedLinkIds(db, userId);
    // gmail returns newest first, flip it so older emails get processed first
    const fresh = listed.ids.filter((id) => !known.has(id)).reverse();
    const queue = [...new Set([...legacy, ...fresh])];
    const batch = queue.slice(0, MAX_FETCH_PER_RUN);

    const { messages, missing, failed } = await getMessagesMetadata(token, batch);
    await storeMessages(db, userId, messages, missing);
    // old imported links shouldn't all show up as new
    const hydrated = new Set([...messages.map((m) => m.id), ...missing]);
    await markViewed(db, userId, legacy.filter((id) => hydrated.has(id)));
    const linked = await linkUnmatched(
      db,
      userId,
      Math.min(since, Date.now() - REMATCH_WINDOW_DAYS * DAY),
    );

    const more = failed.length > 0 || queue.length > batch.length;
    await saveState(db, userId, {
      lastError: null,
      ...(more ? {} : { syncedThrough: runStartedAt }),
    });
    return { fetched: messages.length, linked, more };
  } catch (e) {
    const error =
      e instanceof GmailAuthError
        ? "Gmail access expired or was revoked. Reconnect Gmail in your profile."
        : "Gmail sync failed. It will retry automatically.";
    if (!(e instanceof GmailAuthError)) console.error("gmail sync failed", e);
    await saveState(db, userId, { lastError: error });
    return { fetched: 0, linked: 0, more: true, error };
  }
}

export async function syncGmailIfStale(env: Env, ctx: ExecutionContext, userId: string) {
  const db = getDb(env.DB);
  const status = await getGmailStatus(db, userId);
  if (!status.connected) return;
  if (status.lastRunAt && Date.now() - Date.parse(status.lastRunAt) < STALE_AFTER_MS) return;
  ctx.waitUntil(syncGmail(env, userId));
}

export async function syncAllGmailUsers(env: Env) {
  const db = getDb(env.DB);
  const users = await db
    .selectDistinct({ userId: account.userId })
    .from(account)
    .where(and(eq(account.providerId, "google"), like(account.scope, `%${GMAIL_SCOPE}%`)));
  for (const { userId } of users) await syncGmail(env, userId);
}

async function getAccessToken(env: Env, db: Db, userId: string) {
  const conn = await getGmailAccount(db, userId);
  if (!conn) throw new GmailAuthError("Gmail not connected");
  try {
    const { accessToken } = await createAuth(env).api.getAccessToken({
      body: { accountId: conn.id, userId },
    });
    if (!accessToken) throw new Error("empty token");
    return accessToken;
  } catch {
    throw new GmailAuthError("Could not refresh Gmail token");
  }
}

async function windowStart(db: Db, userId: string, syncedThrough: string | null) {
  // go back an extra day in case gmail delivered something late. dupes get skipped
  if (syncedThrough) return Date.parse(syncedThrough) - DAY;
  const [first] = await db
    .select({ appliedAt: application.appliedAt })
    .from(application)
    .where(eq(application.userId, userId))
    .orderBy(application.appliedAt)
    .limit(1);
  const floor = Date.now() - MAX_LOOKBACK_DAYS * DAY;
  return first ? Math.max(Date.parse(first.appliedAt) - 14 * DAY, floor) : Date.now() - 90 * DAY;
}

// links imported before the sync existed only have a message id, so fetch the rest
async function unhydratedLinkIds(db: Db, userId: string) {
  const rows = await db
    .selectDistinct({ id: emailLink.id })
    .from(emailLink)
    .leftJoin(
      emailMessage,
      and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)),
    )
    .where(and(eq(emailLink.userId, userId), sql`${emailMessage.id} is null`));
  return rows.map((r) => r.id);
}

async function storeMessages(db: Db, userId: string, messages: GmailMessage[], missing: string[]) {
  const rows = [
    ...messages.map((m) => ({
      userId,
      id: m.id,
      threadId: m.threadId,
      category: classifyEmail({ subject: m.subject, body: m.snippet }),
      subject: m.subject,
      snippet: m.snippet,
      fromName: m.fromName,
      fromAddress: m.fromAddress,
      receivedAt: m.receivedAt,
    })),
    // store deleted ones too, otherwise we'd ask gmail for them every run
    ...missing.map((id) => ({ userId, id, category: "deleted", receivedAt: "" })),
  ];
  const stmts = rows.map((r) => db.insert(emailMessage).values(r).onConflictDoNothing());
  if (stmts.length) await db.batch(stmts as [(typeof stmts)[0], ...typeof stmts]);
}

// retries old unmatched emails as well, the application often gets logged after the first email
async function linkUnmatched(db: Db, userId: string, sinceMs: number) {
  const cutoff = new Date(sinceMs).toISOString();
  const unlinked = await db
    .select()
    .from(emailMessage)
    .where(
      and(
        eq(emailMessage.userId, userId),
        gte(emailMessage.receivedAt, cutoff),
        notInArray(emailMessage.category, ["other", "deleted"]),
        sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
      ),
    );
  if (!unlinked.length) return 0;

  const apps = await db
    .select({
      id: application.id,
      company: application.company,
      role: application.role,
      appliedAt: application.appliedAt,
      status: application.status,
    })
    .from(application)
    .where(eq(application.userId, userId));

  const links: (typeof emailLink.$inferInsert)[] = [];
  for (const m of unlinked) {
    const app = matchApplication(m, apps);
    if (!app) continue;
    links.push({
      id: m.id,
      applicationId: app.id,
      userId,
      subject: m.subject,
      snippet: m.snippet,
      fromAddress: m.fromAddress,
      receivedAt: m.receivedAt,
    });
  }
  if (!links.length) return 0;
  const stmts = links.map((l) => db.insert(emailLink).values(l).onConflictDoNothing());
  await db.batch(stmts as [(typeof stmts)[0], ...typeof stmts]);

  const touched = new Set(links.map((l) => l.applicationId));
  for (const app of apps) {
    if (touched.has(app.id)) await refreshStatus(db, userId, app);
  }
  return links.length;
}

// status just follows the latest email
async function refreshStatus(db: Db, userId: string, app: { id: string; status: string }) {
  if (LOCKED_STATUSES.has(app.status)) return;
  const [latest] = await db
    .select({ category: emailMessage.category })
    .from(emailLink)
    .innerJoin(
      emailMessage,
      and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)),
    )
    .where(
      and(
        eq(emailLink.userId, userId),
        eq(emailLink.applicationId, app.id),
        notInArray(emailMessage.category, NON_STAGE_CATEGORIES),
      ),
    )
    .orderBy(desc(emailMessage.receivedAt))
    .limit(1);
  if (latest && latest.category !== app.status) {
    await updateApplication(db, userId, app.id, { status: latest.category });
  }
}

async function saveState(db: Db, userId: string, patch: Partial<typeof gmailSync.$inferInsert>) {
  await db
    .insert(gmailSync)
    .values({ userId, ...patch })
    .onConflictDoUpdate({ target: gmailSync.userId, set: patch });
}
