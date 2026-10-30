import { ACTIVE_STATUSES } from "~/lib/status";
import type { FollowUpItem } from "~/types/up-next";
import type { Db } from "../../db/client.server";
import { followUpRows } from "../../db/queries/applications.server";
import { quietDays } from "./rules";

const FOLLOW_UP_LIMIT = 8;

export async function followUps(db: Db, userId: string, now = new Date()): Promise<FollowUpItem[]> {
  const rows = await followUpRows(db, userId, [...ACTIVE_STATUSES]);
  return rows
    .flatMap(({ applicationId, company, role, lastEmailAt, ...app }) => {
      const days = quietDays(app, lastEmailAt, now);
      return days === null ? [] : [{ applicationId, company, role, quietDays: days }];
    })
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, FOLLOW_UP_LIMIT);
}
