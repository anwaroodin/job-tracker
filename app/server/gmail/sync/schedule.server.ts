import { chunk } from "~/lib/array";
import type { GmailStatus, SyncStage } from "~/types/gmail";
import { getDb, type Db } from "../../db/client.server";
import { unseenActivityCount } from "../../db/queries/activity.server";
import { gmailStatusRow, usersWithAutoSync } from "../../db/queries/gmail-sync.server";
import { syncGmail } from "./index.server";
import { AUTH_ERROR, AUTO_SYNC_EVERY_MS, MIN_GAP_BETWEEN_RUNS_MS, MINUTE } from "./run";

const STUCK_RUN_MS = 2 * MINUTE;
const DEFAULT_SYNC_HOURS = "7-23";
const DEFAULT_SYNC_TIMEZONE = "Europe/London";

function syncHours(env: Env) {
  const [start, end] = (env.SYNC_HOURS ?? DEFAULT_SYNC_HOURS).split("-").map(Number);
  const valid = [start, end].every((h) => Number.isInteger(h) && h >= 0 && h <= 24);
  return valid ? { start, end } : { start: 7, end: 23 };
}

export function isSyncHour(env: Env, now = new Date()) {
  const { start, end } = syncHours(env);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: env.SYNC_TIMEZONE ?? DEFAULT_SYNC_TIMEZONE,
    }).format(now),
  );
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

export async function getGmailStatus(db: Db, userId: string): Promise<GmailStatus> {
  const [[row], [unseen]] = await db.batch([gmailStatusRow(db, userId), unseenActivityCount(db, userId)]);
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
  if (!status.connected || status.syncing || !status.autoSync || !isSyncHour(env)) return false;
  const sinceLastRun = status.lastRunAt ? Date.now() - Date.parse(status.lastRunAt) : Infinity;
  const interval = status.hasMore ? MIN_GAP_BETWEEN_RUNS_MS : AUTO_SYNC_EVERY_MS;
  if (sinceLastRun < interval) return false;
  ctx.waitUntil(syncGmail(env, userId, "auto"));
  return true;
}

/**
 * Fans due users out onto a queue instead of syncing them inline: with many
 * users, one sequential loop in a single scheduled Worker invocation would
 * eventually exceed the CPU/wall-time budget and let one slow/broken user's
 * sync block everyone queued behind them. The queue consumer (workers/app.ts)
 * processes messages in small batches, which Cloudflare runs as multiple
 * parallel invocations as the backlog grows.
 */
export async function enqueueGmailSyncs(env: Env) {
  if (!isSyncHour(env)) return;
  const users = await usersWithAutoSync(getDb(env.DB));
  for (const batch of chunk(users, 100)) {
    await env.GMAIL_SYNC_QUEUE.sendBatch(batch.map((u) => ({ body: { userId: u.userId } })));
  }
}
