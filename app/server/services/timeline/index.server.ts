import { NEEDS_REPLY_PROBABILITY } from "~/lib/email";
import type { TimelineEmail } from "~/types/timeline";
import type { Db } from "../../db/client.server";
import { applicationEmailRows } from "../../db/queries/emails.server";
import { isConfident } from "../../email/classify/index.server";

export async function getApplicationEmails(
  db: Db,
  userId: string,
  applicationId: string,
  minConfidence: number,
): Promise<TimelineEmail[]> {
  const rows = await applicationEmailRows(db, userId, applicationId);
  // unsynced and deleted emails have no date, push them to the bottom
  const key = (r: (typeof rows)[number]) => r.receivedAt || "~";
  return rows
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
    .map(({ confidence, manualCategoryAt, manualKind, needsReply, replyDoneAt, ...row }) => ({
      ...row,
      needsReply: (needsReply ?? 0) >= NEEDS_REPLY_PROBABILITY && !replyDoneAt,
      unsure: !manualCategoryAt && !isConfident(confidence ?? null, minConfidence),
      confirmed: !!manualCategoryAt && manualKind === "confirmed",
      edited: !!manualCategoryAt && manualKind !== "confirmed",
    }));
}
