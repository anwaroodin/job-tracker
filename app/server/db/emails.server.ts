import { and, asc, desc, eq, gte, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import type { EmailCategory } from "~/lib/email";
import { isConfident } from "../email/classifier.server";
import {
  MIN_APPLICATION_PROBABILITY,
  normalizeCompany,
  SUGGESTION_LOOKBACK_MS,
} from "../email/suggestions.server";
import type { Db } from "./client.server";
import { application, emailLink, emailMessage } from "./schema";

const NEEDS_REPLY_PROBABILITY = 0.6;
const REPLY_WINDOW_MS = 30 * 86_400_000;
const CLOSED_STATUSES = ["rejected", "withdrawn", "ghosted", "accepted"];
const UP_NEXT_LIMIT = 8;

export async function getApplicationEmails(db: Db, userId: string, applicationId: string, minConfidence: number) {
  const rows = await db
    .select({
      id: emailLink.id,
      threadId: emailMessage.threadId,
      viewedAt: emailLink.viewedAt,
      dismissedAt: emailLink.dismissedAt,
      category: emailMessage.category,
      confidence: emailMessage.confidence,
      manualCategoryAt: emailMessage.manualCategoryAt,
      manualKind: emailMessage.manualKind,
      eventAt: emailMessage.eventAt,
      eventText: emailMessage.eventText,
      actionUrl: emailMessage.actionUrl,
      actionText: emailMessage.actionText,
      needsReply: emailMessage.needsReply,
      replyDoneAt: emailMessage.replyDoneAt,
      subject: emailMessage.subject,
      snippet: emailMessage.snippet,
      fromName: emailMessage.fromName,
      fromAddress: emailMessage.fromAddress,
      receivedAt: emailMessage.receivedAt,
    })
    .from(emailLink)
    .leftJoin(
      emailMessage,
      and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)),
    )
    .where(and(eq(emailLink.userId, userId), eq(emailLink.applicationId, applicationId)));
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

export async function unreadEmailCounts(db: Db, userId: string) {
  const rows = await db
    .select({
      applicationId: emailLink.applicationId,
      count: sql<number>`count(*)`,
    })
    .from(emailLink)
    .innerJoin(
      emailMessage,
      and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)),
    )
    .where(
      and(
        eq(emailLink.userId, userId),
        sql`${emailLink.viewedAt} is null`,
        isNull(emailLink.dismissedAt),
        ne(emailMessage.category, "deleted"),
      ),
    )
    .groupBy(emailLink.applicationId);
  return Object.fromEntries(rows.map((r) => [r.applicationId, r.count]));
}

export async function markViewed(db: Db, userId: string, ids: string[]) {
  const now = new Date().toISOString();
  // d1 only allows 100 bound params per query
  for (let i = 0; i < ids.length; i += 90) {
    await db
      .update(emailLink)
      .set({ viewedAt: now })
      .where(
        and(
          eq(emailLink.userId, userId),
          inArray(emailLink.id, ids.slice(i, i + 90)),
          sql`${emailLink.viewedAt} is null`,
        ),
      );
  }
}

export async function setEmailCategory(db: Db, userId: string, emailId: string, category: EmailCategory) {
  await db
    .update(emailMessage)
    .set({
      category,
      manualCategoryAt: new Date().toISOString(),
      manualKind: sql`case when ${emailMessage.category} = ${category} then 'confirmed' else 'corrected' end`,
      detailsAt: sql`case when ${emailMessage.category} = ${category} then ${emailMessage.detailsAt} else null end`,
    })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, emailId), ne(emailMessage.category, "deleted")));
}

export async function setEmailDismissed(
  db: Db,
  userId: string,
  applicationId: string,
  emailId: string,
  dismissed: boolean,
) {
  await db
    .update(emailLink)
    .set({ dismissedAt: dismissed ? new Date().toISOString() : null })
    .where(and(eq(emailLink.userId, userId), eq(emailLink.applicationId, applicationId), eq(emailLink.id, emailId)));
}

export async function markReplyDone(db: Db, userId: string, emailId: string) {
  await db
    .update(emailMessage)
    .set({ replyDoneAt: new Date().toISOString() })
    .where(and(eq(emailMessage.userId, userId), eq(emailMessage.id, emailId)));
}

export async function upNext(db: Db, userId: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const needsReply = and(
    gte(emailMessage.needsReply, NEEDS_REPLY_PROBABILITY),
    isNull(emailMessage.replyDoneAt),
    gte(emailMessage.receivedAt, new Date(now.getTime() - REPLY_WINDOW_MS).toISOString()),
  );
  const rows = await db
    .select({
      emailId: emailMessage.id,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      category: emailMessage.category,
      subject: emailMessage.subject,
      receivedAt: emailMessage.receivedAt,
      eventAt: emailMessage.eventAt,
      replyNeeded: sql<number>`case when ${needsReply} then 1 else 0 end`,
    })
    .from(emailLink)
    .innerJoin(emailMessage, and(eq(emailMessage.userId, emailLink.userId), eq(emailMessage.id, emailLink.id)))
    .innerJoin(application, eq(application.id, emailLink.applicationId))
    .where(
      and(
        eq(emailLink.userId, userId),
        isNull(emailLink.dismissedAt),
        notInArray(application.status, CLOSED_STATUSES),
        or(gte(emailMessage.eventAt, today), needsReply),
      ),
    )
    .orderBy(asc(emailMessage.eventAt), desc(emailMessage.receivedAt));
  const replies = rows.filter((r) => r.replyNeeded).slice(0, UP_NEXT_LIMIT);
  const upcoming = rows
    .filter((r) => r.eventAt && r.eventAt >= today)
    .sort((a, b) => a.eventAt!.localeCompare(b.eventAt!))
    .slice(0, UP_NEXT_LIMIT);
  return { replies, upcoming };
}

export type UpNext = Awaited<ReturnType<typeof upNext>>;

export async function applicationSuggestions(db: Db, userId: string) {
  const [emails, apps] = await db.batch([
    db
      .select({
        id: emailMessage.id,
        threadId: emailMessage.threadId,
        company: emailMessage.suggestedCompany,
        role: emailMessage.suggestedRole,
        subject: emailMessage.subject,
        fromName: emailMessage.fromName,
        fromAddress: emailMessage.fromAddress,
        receivedAt: emailMessage.receivedAt,
      })
      .from(emailMessage)
      .where(
        and(
          eq(emailMessage.userId, userId),
          eq(emailMessage.category, "applied"),
          gte(emailMessage.isApplication, MIN_APPLICATION_PROBABILITY),
          isNull(emailMessage.suggestionDismissedAt),
          gte(emailMessage.receivedAt, new Date(Date.now() - SUGGESTION_LOOKBACK_MS).toISOString()),
          sql`not exists (select 1 from ${emailLink} where ${emailLink.userId} = ${emailMessage.userId} and ${emailLink.id} = ${emailMessage.id})`,
        ),
      )
      .orderBy(asc(emailMessage.receivedAt)),
    db
      .select({ id: application.id, company: application.company, role: application.role })
      .from(application)
      .where(eq(application.userId, userId))
      .orderBy(desc(application.appliedAt)),
  ]);

  const existingByCompany = new Map<string, (typeof apps)[number]>();
  for (const app of apps) {
    const key = normalizeCompany(app.company);
    if (key && !existingByCompany.has(key)) existingByCompany.set(key, app);
  }

  const groups = new Map<string, Suggestion>();
  for (const email of emails) {
    const companyKey = email.company ? normalizeCompany(email.company) : "";
    const key = companyKey ? `${companyKey}|${(email.role ?? "").toLowerCase()}` : email.id;
    const group = groups.get(key);
    if (group) {
      group.emailIds.push(email.id);
      group.latestThreadId = email.threadId || email.id;
      group.subject = email.subject;
      group.company ||= email.company ?? "";
      group.role ||= email.role ?? "";
      continue;
    }
    groups.set(key, {
      key,
      company: email.company ?? "",
      role: email.role ?? "",
      appliedAt: email.receivedAt,
      emailIds: [email.id],
      latestThreadId: email.threadId || email.id,
      subject: email.subject,
      from: email.fromName || email.fromAddress,
      existing: (companyKey && existingByCompany.get(companyKey)) || null,
    });
  }
  return mergeRolelessIntoSibling([...groups.values()]).reverse();
}

function mergeRolelessIntoSibling(suggestions: Suggestion[]) {
  const withRole = new Map<string, Suggestion>();
  for (const s of suggestions) if (s.role && s.company) withRole.set(normalizeCompany(s.company), s);
  return suggestions.filter((s) => {
    const sibling = !s.role && s.company ? withRole.get(normalizeCompany(s.company)) : undefined;
    if (!sibling) return true;
    sibling.emailIds.push(...s.emailIds);
    if (s.appliedAt < sibling.appliedAt) sibling.appliedAt = s.appliedAt;
    if (s.appliedAt > sibling.appliedAt) sibling.latestThreadId = s.latestThreadId;
    return false;
  });
}

export interface Suggestion {
  key: string;
  company: string;
  role: string;
  appliedAt: string;
  emailIds: string[];
  latestThreadId: string;
  subject: string;
  from: string;
  existing: { id: string; company: string; role: string } | null;
}

export async function linkEmailsToApplication(db: Db, userId: string, applicationId: string, emailIds: string[]) {
  const [owned] = await db
    .select({ id: application.id })
    .from(application)
    .where(and(eq(application.id, applicationId), eq(application.userId, userId)))
    .limit(1);
  if (!owned || !emailIds.length) return;
  const emails = await db
    .select({ id: emailMessage.id })
    .from(emailMessage)
    .where(and(eq(emailMessage.userId, userId), inArray(emailMessage.id, emailIds.slice(0, 90))));
  const viewedAt = new Date().toISOString();
  for (let i = 0; i < emails.length; i += 20) {
    await db
      .insert(emailLink)
      .values(emails.slice(i, i + 20).map((e) => ({ id: e.id, applicationId, userId, viewedAt })))
      .onConflictDoNothing();
  }
}

export async function dismissSuggestions(db: Db, userId: string, emailIds: string[]) {
  if (!emailIds.length) return;
  await db
    .update(emailMessage)
    .set({ suggestionDismissedAt: new Date().toISOString() })
    .where(and(eq(emailMessage.userId, userId), inArray(emailMessage.id, emailIds.slice(0, 90))));
}
