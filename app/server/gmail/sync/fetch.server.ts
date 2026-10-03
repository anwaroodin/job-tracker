import type { Db } from "../../db/client.server";
import { prunedEmailsToFetchAgain, REFETCH_PER_RUN } from "../../db/queries/email-retention.server";
import { storedEmailIdsSince } from "../../db/queries/email-sync.server";
import type { ClassifiableEmail } from "../../email/classify/index.server";
import { getMailboxAddress, getMessagesMetadata, listMessageIds } from "../client.server";
import type { GmailMessage } from "../mapping.server";
import { setStage } from "../../db/queries/gmail-sync.server";
import type { Fetched, ReclassifiableEmail, Run } from "./run";
import { DAY, MAX_LOOKBACK_MS } from "./run";

const MAX_LIST_PAGES = 4;
const MAX_FETCH_PER_RUN = 150;
const FIRST_SYNC_LOOKBACK_MS = 90 * DAY;
const LOOKBACK_BEFORE_FIRST_APPLICATION_MS = 14 * DAY;
const LATE_DELIVERY_OVERLAP_MS = DAY;

const JOB_EMAIL_SEARCH =
  "-in:sent -in:drafts -in:chats " +
  '{application applied applying applicant candidate candidacy interview assessment offer unfortunately "next steps" ' +
  'recruiter recruiting hiring "coding challenge" "take-home" hackerrank codility codesignal hirevue testgorilla}';

export async function fetchNewMessages(token: string, db: Db, run: Run): Promise<Fetched> {
  // Stubs of pruned emails are downloaded again when they may be job-related
  // after all (see email/retention.server.ts); they're already "known", so they have to
  // be queued explicitly.
  const canJudgeWith = !run.classifier.startsWith("jev") || run.useJev ? run.classifier : null;
  const [storedIds, listed, toFetchAgain] = await Promise.all([
    storedEmailIdsSince(db, run.userId, run.since - LATE_DELIVERY_OVERLAP_MS),
    listMessageIds(token, `after:${Math.floor(run.since / 1000)} ${JOB_EMAIL_SEARCH}`, MAX_LIST_PAGES),
    prunedEmailsToFetchAgain(db, run.userId, canJudgeWith, Date.now() - MAX_LOOKBACK_MS),
  ]);

  const known = new Set(storedIds.map((r) => r.id));
  // New mail first, oldest first; stubs use whatever room is left in this run.
  const newMail = listed.ids.filter((id) => !known.has(id)).reverse();
  const fetchAgain = toFetchAgain.map((r) => r.id).filter((id) => !newMail.includes(id));
  const thisRun = [...newMail, ...fetchAgain].slice(0, MAX_FETCH_PER_RUN);

  if (thisRun.length) await setStage(db, run.userId, "downloading", thisRun.length);
  const { messages, missing, failed } = await getMessagesMetadata(token, thisRun);
  return {
    messages,
    missing,
    // Only new mail holds back syncedThrough; stubs waiting to be fetched
    // again just bring the next run forward.
    more: failed.length > 0 || newMail.length > MAX_FETCH_PER_RUN,
    moreToFetchAgain: toFetchAgain.length === REFETCH_PER_RUN || newMail.length + fetchAgain.length > MAX_FETCH_PER_RUN,
  };
}

export async function withSentByUser(
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

export function searchWindowStart(syncedThrough: string | null, firstAppliedAt: string | undefined) {
  if (syncedThrough) return Date.parse(syncedThrough) - LATE_DELIVERY_OVERLAP_MS;
  if (!firstAppliedAt) return Date.now() - FIRST_SYNC_LOOKBACK_MS;
  return Math.max(Date.parse(firstAppliedAt) - LOOKBACK_BEFORE_FIRST_APPLICATION_MS, Date.now() - MAX_LOOKBACK_MS);
}
