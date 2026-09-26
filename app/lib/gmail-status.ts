import { useFetcher } from "react-router";
import type { GmailStatus } from "~/server/gmail/sync.server";
import { fmtAgo } from "./time";

export const GMAIL_STATUS_URL = "/api/gmail/status";
export const GMAIL_STATUS_KEY = "gmail-status";

export function useGmailStatus(initial: GmailStatus) {
  const poll = useFetcher<GmailStatus>({ key: GMAIL_STATUS_KEY });
  return poll.data && "connected" in poll.data ? poll.data : initial;
}

export function syncedAgo(status: GmailStatus, now = Date.now()) {
  const at = status.lastFinishedAt ?? status.lastRunAt;
  return at ? fmtAgo(at, now) : null;
}
