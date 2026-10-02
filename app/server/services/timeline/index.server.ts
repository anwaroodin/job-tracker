import { NEEDS_REPLY_PROBABILITY } from "~/lib/email";
import type { TimelineEmail } from "~/types/timeline";
import type { Db } from "../../db/client.server";
import { applicationById } from "../../db/queries/applications.server";
import { applicationEmailRows } from "../../db/queries/emails.server";
import { settingsRowFor, withDefaults } from "../../db/queries/settings.server";
import { isConfident } from "../../email/classify/index.server";

type EmailRow = Awaited<ReturnType<typeof applicationEmailRows>>[number];

export async function applicationTimeline(db: Db, userId: string, applicationId: string) {
  const [[settingsRow], [row], emailRows] = await db.batch([
    settingsRowFor(db, userId),
    applicationById(db, userId, applicationId),
    applicationEmailRows(db, userId, applicationId),
  ]);
  return { row: row ?? null, emails: toTimeline(emailRows, withDefaults(settingsRow).minConfidence) };
}

function toTimeline(rows: EmailRow[], minConfidence: number): TimelineEmail[] {
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
