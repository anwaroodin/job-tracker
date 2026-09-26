import { and, asc, desc, eq, gte, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { APPLICATION_CATEGORIES, NEEDS_REPLY_PROBABILITY, type EmailCategory } from "~/lib/email";
import { isConfident } from "../email/classifier.server";
import {
  isCompany,
  isRole,
  MIN_APPLICATION_PROBABILITY,
  normalizeCompany,
  SUGGESTION_LOOKBACK_MS,
} from "../email/suggestions.server";
import type { Db } from "./client.server";
import { application, emailLink, emailMessage } from "./schema";

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
        category: emailMessage.category,
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
          inArray(emailMessage.category, [...APPLICATION_CATEGORIES]),
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

  const byThread = new Map<string, typeof emails>();
  for (const email of emails) {
    const thread = email.threadId || email.id;
    byThread.set(thread, [...(byThread.get(thread) ?? []), email]);
  }
  const threads = [...byThread.entries()].map(([thread, threadEmails]) => {
    const first = threadEmails[0];
    const last = threadEmails[threadEmails.length - 1];
    const company = mostCommon(threadEmails.map((e) => e.company).filter(isCompany), normalizeCompany);
    const role = mostCommon(threadEmails.map((e) => e.role).filter(isRole), (r) => r.toLowerCase());
    return {
      key: thread,
      company,
      role,
      appliedAt: first.receivedAt,
      lastReceivedAt: last.receivedAt,
      emailIds: threadEmails.map((e) => e.id),
      latestThreadId: thread,
      category: last.category,
      subject: last.subject,
      from: last.fromName || last.fromAddress,
      existing: (company && existingByCompany.get(normalizeCompany(company))) || null,
    } satisfies Suggestion;
  });

  const merged = mergeWhere(threads, (s) => (s.company && s.role ? `${normalizeCompany(s.company)}|${s.role.toLowerCase()}` : null));
  const withRole = new Map(merged.filter((s) => s.company && s.role).map((s) => [normalizeCompany(s.company), s]));
  const result = merged.filter((s) => {
    const sibling = s.company && !s.role ? withRole.get(normalizeCompany(s.company)) : undefined;
    if (sibling) absorb(sibling, s);
    return !sibling;
  });
  return result.sort((a, b) => b.lastReceivedAt.localeCompare(a.lastReceivedAt));
}

function mostCommon(values: string[], keyOf: (value: string) => string) {
  const counts = new Map<string, { value: string; count: number }>();
  for (const value of values) {
    const key = keyOf(value);
    const entry = counts.get(key) ?? { value, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.value ?? "";
}

function mergeWhere(suggestions: Suggestion[], keyOf: (s: Suggestion) => string | null) {
  const byKey = new Map<string, Suggestion>();
  return suggestions.filter((s) => {
    const key = keyOf(s);
    const target = key ? byKey.get(key) : undefined;
    if (target) absorb(target, s);
    else if (key) byKey.set(key, s);
    return !target;
  });
}

function absorb(target: Suggestion, other: Suggestion) {
  target.emailIds.push(...other.emailIds);
  if (other.appliedAt < target.appliedAt) target.appliedAt = other.appliedAt;
  if (other.lastReceivedAt > target.lastReceivedAt) {
    target.lastReceivedAt = other.lastReceivedAt;
    target.latestThreadId = other.latestThreadId;
    target.category = other.category;
    target.subject = other.subject;
    target.from = other.from;
  }
}

export interface Suggestion {
  key: string;
  company: string;
  role: string;
  appliedAt: string;
  lastReceivedAt: string;
  emailIds: string[];
  latestThreadId: string;
  category: string;
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
