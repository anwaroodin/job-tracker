import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { ActivityItem, ActivityKind } from "~/lib/activity";
import type { Db } from "../client.server";
import { activity, application, emailLink, emailMessage } from "../schema";

const RECENT_ACTIVITY = 100;

const isLive = sql`(${activity.kind} != 'suggestion' or exists (
  select 1 from ${emailMessage}
  where ${emailMessage.userId} = ${activity.userId} and ${emailMessage.id} = ${activity.emailId}
    and ${emailMessage.suggestionDismissedAt} is null
    and not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})
))`;

export interface NewActivity {
  kind: ActivityKind;
  applicationId?: string | null;
  emailId?: string | null;
  detail?: Record<string, string | null>;
}

export function activityInserts(db: Db, userId: string, items: NewActivity[], createdAt: string) {
  return items.map((item) =>
    db.insert(activity).values({
      id: crypto.randomUUID(),
      userId,
      createdAt,
      kind: item.kind,
      applicationId: item.applicationId ?? null,
      emailId: item.emailId ?? null,
      detail: item.detail ? JSON.stringify(item.detail) : null,
    }),
  );
}

export function unseenActivityCount(db: Db, userId: string) {
  return db
    .select({ count: sql<number>`count(*)` })
    .from(activity)
    .where(and(eq(activity.userId, userId), isNull(activity.seenAt), isLive));
}

export async function recentActivity(db: Db, userId: string): Promise<ActivityItem[]> {
  const rows = await db
    .select({
      id: activity.id,
      kind: activity.kind,
      createdAt: activity.createdAt,
      seenAt: activity.seenAt,
      applicationId: activity.applicationId,
      detail: activity.detail,
      company: application.company,
      subject: emailMessage.subject,
    })
    .from(activity)
    .leftJoin(application, eq(application.id, activity.applicationId))
    .leftJoin(emailMessage, and(eq(emailMessage.userId, activity.userId), eq(emailMessage.id, activity.emailId)))
    .where(and(eq(activity.userId, userId), isLive))
    .orderBy(desc(activity.createdAt))
    .limit(RECENT_ACTIVITY);
  return rows.map(({ seenAt, detail, kind, ...row }) => ({
    ...row,
    kind: kind as ActivityKind,
    seen: seenAt !== null,
    detail: detail ? (JSON.parse(detail) as Record<string, string | null>) : {},
  }));
}

export async function markActivitySeen(db: Db, userId: string) {
  await db
    .update(activity)
    .set({ seenAt: new Date().toISOString() })
    .where(and(eq(activity.userId, userId), isNull(activity.seenAt)));
}
