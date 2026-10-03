import type { Settings } from "~/lib/settings";
import type { GmailMessage } from "../mapping.server";
import type { Classification } from "../../email/classify/index.server";
import type { emailMessage } from "../../db/schema";
import type { storedEmails } from "../../db/queries/email-sync.server";
import type { applicationsFor, latestStageEmailPerApplication } from "../../db/queries/status.server";

export const MINUTE = 60_000;
export const DAY = 86_400_000;
export const AUTO_SYNC_EVERY_MS = 15 * MINUTE;
export const MIN_GAP_BETWEEN_RUNS_MS = MINUTE;
const RECENT_FOR_ACTIVITY_MS = 7 * DAY;
export const MAX_LOOKBACK_MS = 180 * DAY;
export const AUTH_ERROR = "Gmail access expired or was revoked. Reconnect Gmail in your profile.";

export interface Run {
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
  applicationsChanged: boolean;
}

export interface Fetched {
  messages: GmailMessage[];
  missing: string[];
  /** New mail is left over for the next run (so syncedThrough mustn't advance). */
  more: boolean;
  /** Pruned stubs are still waiting to be downloaded again. */
  moreToFetchAgain: boolean;
}

export interface CategoryChange extends Classification {
  id: string;
}

export interface Plan {
  links: { emailId: string; applicationId: string; category: string; receivedAt: string }[];
  statusChanges: { applicationId: string; status: string; from: string }[];
}

export type StoredEmail = typeof emailMessage.$inferSelect;

export type ReclassifiableEmail = Awaited<ReturnType<typeof storedEmails>>[number];

export type TrackedApplication = Awaited<ReturnType<typeof applicationsFor>>[number];

export type LatestStage = Awaited<ReturnType<typeof latestStageEmailPerApplication>>[number];

export function isRecent(receivedAt: string) {
  return Date.now() - Date.parse(receivedAt) < RECENT_FOR_ACTIVITY_MS;
}
