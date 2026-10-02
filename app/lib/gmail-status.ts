import { useEffect, useSyncExternalStore } from "react";
import type { GmailStatus } from "~/types/gmail";
import { fmtAgo } from "./format/time";

export const GMAIL_STATUS_URL = "/api/gmail/status";

const POLL_WHILE_SYNCING_MS = 1500;
const POLL_WHILE_IDLE_MS = 120_000;
const CHANNEL_NAME = "gmail-status-sync";
const LOCK_NAME = "gmail-status-leader";

/**
 * Only one open tab (whichever holds the Web Lock below) ever polls
 * /api/gmail/status; the rest just listen on a BroadcastChannel for what the
 * leader fetched. Without this, N open tabs would each poll independently —
 * N times the requests (and N times the chance of redundantly kicking off a
 * background sync) for the exact same data. If a leader tab closes, the
 * lock releases and the next queued tab takes over automatically.
 *
 * Falls back to per-tab polling (the old behaviour) when Web Locks or
 * BroadcastChannel aren't available.
 */

let latest: GmailStatus | undefined;
const listeners = new Set<() => void>();
const wake = new EventTarget();
let started = false;

function emit(status: GmailStatus) {
  latest = status;
  listeners.forEach((l) => l());
}

function poke() {
  wake.dispatchEvent(new Event("poke"));
}

function waitFor(ms: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      wake.removeEventListener("poke", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    wake.addEventListener("poke", done, { once: true });
  });
}

async function fetchStatus(): Promise<GmailStatus | null> {
  try {
    const res = await fetch(GMAIL_STATUS_URL, { credentials: "same-origin" });
    return res.ok ? ((await res.json()) as GmailStatus) : null;
  } catch {
    return null;
  }
}

function startSharedPolling() {
  if (started || typeof window === "undefined") return;
  started = true;

  const canShare = "locks" in navigator && typeof BroadcastChannel !== "undefined";
  const channel = canShare ? new BroadcastChannel(CHANNEL_NAME) : null;
  channel?.addEventListener("message", (e) => {
    if (e.data?.type === "status") emit(e.data.status as GmailStatus);
    if (e.data?.type === "refresh") poke();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (channel) channel.postMessage({ type: "refresh" });
    else poke(); // no cross-tab sharing available: this tab polls for itself
  });

  const loop = async () => {
    for (;;) {
      if (document.visibilityState === "visible") {
        const status = await fetchStatus();
        if (status) {
          emit(status);
          channel?.postMessage({ type: "status", status });
        }
      }
      await waitFor(latest?.syncing ? POLL_WHILE_SYNCING_MS : POLL_WHILE_IDLE_MS);
    }
  };

  if (canShare) navigator.locks.request(LOCK_NAME, loop);
  else loop();
}

export function useGmailStatus(initial: GmailStatus): GmailStatus {
  useEffect(startSharedPolling, []);
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => latest ?? initial,
    () => initial,
  );
}

export function syncedAgo(status: GmailStatus, now = Date.now()) {
  const at = status.lastFinishedAt ?? status.lastRunAt;
  return at ? fmtAgo(at, now) : null;
}
