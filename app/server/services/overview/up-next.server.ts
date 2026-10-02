import type { UpNext } from "~/types/up-next";
import type { Db } from "../../db/client.server";
import { upNextRows } from "../../db/queries/emails.server";

const REPLY_WINDOW_MS = 30 * 86_400_000;
const UP_NEXT_LIMIT = 8;

export async function upNext(db: Db, userId: string): Promise<UpNext> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const rows = await upNextRows(db, userId, today, new Date(now.getTime() - REPLY_WINDOW_MS).toISOString());
  const replies = rows.filter((r) => r.replyNeeded).slice(0, UP_NEXT_LIMIT);
  const upcoming = rows
    .filter((r) => r.eventAt && r.eventAt >= today)
    .sort((a, b) => a.eventAt!.localeCompare(b.eventAt!))
    .slice(0, UP_NEXT_LIMIT);
  return { replies, upcoming };
}
