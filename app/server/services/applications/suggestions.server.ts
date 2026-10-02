import type { Suggestion } from "~/types/suggestion";
import type { Db } from "../../db/client.server";
import { suggestionRows } from "../../db/queries/emails.server";
import {
  isCompany,
  isRole,
  MIN_APPLICATION_PROBABILITY,
  normalizeCompany,
  SUGGESTION_LOOKBACK_MS,
} from "../../email/suggestions.server";

export async function applicationSuggestions(db: Db, userId: string) {
  const since = new Date(Date.now() - SUGGESTION_LOOKBACK_MS).toISOString();
  const [emails, apps] = await suggestionRows(db, userId, MIN_APPLICATION_PROBABILITY, since);

  const existingByCompany = new Map<string, (typeof apps)[number]>();
  for (const app of apps) {
    const key = normalizeCompany(app.company);
    if (key && !existingByCompany.has(key)) existingByCompany.set(key, app);
  }

  const byThread = new Map<string, typeof emails>();
  for (const email of emails) {
    const thread = email.threadId || email.id;
    const threadEmails = byThread.get(thread);
    if (threadEmails) threadEmails.push(email);
    else byThread.set(thread, [email]);
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
