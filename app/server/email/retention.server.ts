import { chunk } from "~/lib/array";
import { asBatch, MAX_IDS_PER_STATEMENT } from "../db/batch.server";
import type { Db } from "../db/client.server";
import type { UnsureEmail } from "~/types/unsure-email";
import {
  markJudgedBy,
  pruneConfirmedEmail,
  pruneUnrelatedEmails,
  unsureUnrelatedEmails,
} from "../db/queries/email-retention.server";
import { getSettings } from "../db/queries/settings.server";
import { activeClassifier, REGEX_CLASSIFIER } from "./classify/index.server";

/**
 * Clears the content of emails known not to be about jobs (the rules are in
 * db/queries/email-retention.server.ts). Emails Jev failed on this run were
 * judged by keyword rules instead, so their stubs say so and they get a proper
 * look once Jev is back.
 */
export async function pruneAfterRun(
  db: Db,
  userId: string,
  classifier: string,
  minConfidence: number,
  fellBack: Set<string>,
) {
  const prunedAt = new Date().toISOString();
  await db.batch(
    asBatch([
      pruneUnrelatedEmails(db, userId, classifier, prunedAt, minConfidence),
      ...chunk([...fellBack], MAX_IDS_PER_STATEMENT).map((ids) => markJudgedBy(db, userId, ids, REGEX_CLASSIFIER)),
    ]),
  );
}

export async function confirmNotAboutJobs(env: Env, db: Db, userId: string, emailId: string) {
  const settings = await getSettings(db, userId);
  await pruneConfirmedEmail(db, userId, emailId, activeClassifier(env, settings), new Date().toISOString());
}

export async function emailsToConfirm(db: Db, userId: string): Promise<UnsureEmail[]> {
  const { minConfidence } = await getSettings(db, userId);
  return unsureUnrelatedEmails(db, userId, minConfidence);
}
