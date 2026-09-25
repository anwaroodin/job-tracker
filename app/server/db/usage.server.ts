import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import type { Settings } from "~/lib/settings";
import { DOLLARS_PER_INPUT_TOKEN } from "../jev/client.server";
import type { StageUsage } from "../jev/email-stage.server";
import type { Db } from "./client.server";
import { emailMessage, jevUsage } from "./schema";

const DAY_MS = 86_400_000;
const CHART_DAYS = 30;
const RECENT_REQUESTS = 12;
const TYPICAL_TOKENS_PER_EMAIL = 700;

export const dollars = (tokens: number) => tokens * DOLLARS_PER_INPUT_TOKEN;

export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function tokensSince(db: Db, userId: string, since: string) {
  return db
    .select({ tokens: sql<number>`coalesce(sum(${jevUsage.inputTokens}), 0)` })
    .from(jevUsage)
    .where(and(eq(jevUsage.userId, userId), gte(jevUsage.createdAt, since)));
}

export function usageRows(userId: string, usage: StageUsage[], createdAt: string) {
  return usage.map((u) => ({ id: crypto.randomUUID(), userId, createdAt, ...u }));
}

export async function usageDashboard(db: Db, userId: string, settings: Settings) {
  const now = new Date();
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const chartStart = new Date(Date.parse(now.toISOString().slice(0, 10)) - (CHART_DAYS - 1) * DAY_MS).toISOString();
  const windowStart = chartStart < lastMonth ? chartStart : lastMonth;

  const [recentRows, [allTime], latest, [emailStats]] = await db.batch([
    db
      .select()
      .from(jevUsage)
      .where(and(eq(jevUsage.userId, userId), gte(jevUsage.createdAt, windowStart))),
    db
      .select({
        tokens: sql<number>`coalesce(sum(${jevUsage.inputTokens}), 0)`,
        requests: sql<number>`count(*)`,
        first: sql<string | null>`min(${jevUsage.createdAt})`,
      })
      .from(jevUsage)
      .where(eq(jevUsage.userId, userId)),
    db
      .select()
      .from(jevUsage)
      .where(eq(jevUsage.userId, userId))
      .orderBy(desc(jevUsage.createdAt))
      .limit(RECENT_REQUESTS),
    db
      .select({
        stored: sql<number>`sum(case when ${emailMessage.manualCategoryAt} is null then 1 else 0 end)`,
        byJev: sql<number>`sum(case when ${emailMessage.confidence} is not null then 1 else 0 end)`,
        unsure: sql<number>`sum(case when ${emailMessage.confidence} < ${settings.minConfidence} and ${emailMessage.manualCategoryAt} is null then 1 else 0 end)`,
        corrected: sql<number>`sum(case when ${emailMessage.manualCategoryAt} is not null and coalesce(${emailMessage.manualKind}, 'corrected') = 'corrected' then 1 else 0 end)`,
        confirmed: sql<number>`sum(case when ${emailMessage.manualKind} = 'confirmed' then 1 else 0 end)`,
      })
      .from(emailMessage)
      .where(and(eq(emailMessage.userId, userId), ne(emailMessage.category, "deleted"))),
  ]);

  const inMonth = recentRows.filter((r) => r.createdAt >= thisMonth);
  const lastMonthRows = recentRows.filter((r) => r.createdAt >= lastMonth && r.createdAt < thisMonth);
  const sum = (rows: typeof recentRows, pick: (r: (typeof recentRows)[number]) => number) =>
    rows.reduce((total, r) => total + pick(r), 0);

  const monthTokens = sum(inMonth, (r) => r.inputTokens);
  const monthEmails = sum(inMonth.filter((r) => r.source === "snippet"), (r) => r.emails);
  const monthBodies = sum(inMonth.filter((r) => r.source === "body"), (r) => r.emails);
  const monthCost = dollars(monthTokens);

  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const daysElapsed = (now.getTime() - Date.parse(thisMonth)) / DAY_MS;
  const projected = daysElapsed > 0 ? (monthCost / daysElapsed) * daysInMonth : 0;

  const allTimeTokens = Number(allTime?.tokens ?? 0);
  const perEmailTokens = monthEmails ? monthTokens / monthEmails : 0;

  const daily = Array.from({ length: CHART_DAYS }, (_, i) => {
    const day = new Date(Date.parse(chartStart) + i * DAY_MS).toISOString().slice(0, 10);
    const tokens = sum(
      recentRows.filter((r) => r.createdAt.startsWith(day)),
      (r) => r.inputTokens,
    );
    return { day, cost: dollars(tokens) };
  });

  return {
    month: {
      cost: monthCost,
      projected,
      emails: monthEmails,
      bodies: monthBodies,
      requests: inMonth.length,
      tokensPerEmail: Math.round(perEmailTokens),
      costPer1000: dollars(perEmailTokens * 1000),
    },
    lastMonthCost: dollars(sum(lastMonthRows, (r) => r.inputTokens)),
    allTime: { cost: dollars(allTimeTokens), requests: Number(allTime?.requests ?? 0), since: allTime?.first ?? null },
    budget: settings.monthlyBudget,
    daily,
    recent: latest.map((r) => ({ ...r, cost: dollars(r.inputTokens) })),
    emails: {
      stored: Number(emailStats?.stored ?? 0),
      byJev: Number(emailStats?.byJev ?? 0),
      unsure: Number(emailStats?.unsure ?? 0),
      corrected: Number(emailStats?.corrected ?? 0),
      confirmed: Number(emailStats?.confirmed ?? 0),
    },
  };
}

export type UsageDashboard = Awaited<ReturnType<typeof usageDashboard>>;

export async function reclassifyEstimate(db: Db, userId: string) {
  const [[emails], [usage]] = await db.batch([
    db
      .select({ count: sql<number>`count(*)` })
      .from(emailMessage)
      .where(
        and(eq(emailMessage.userId, userId), ne(emailMessage.category, "deleted"), sql`${emailMessage.manualCategoryAt} is null`),
      ),
    db
      .select({
        tokens: sql<number>`coalesce(sum(${jevUsage.inputTokens}), 0)`,
        emails: sql<number>`coalesce(sum(case when ${jevUsage.source} = 'snippet' then ${jevUsage.emails} else 0 end), 0)`,
      })
      .from(jevUsage)
      .where(eq(jevUsage.userId, userId)),
  ]);
  const count = Number(emails?.count ?? 0);
  const perEmail = usage?.emails ? Number(usage.tokens) / Number(usage.emails) : TYPICAL_TOKENS_PER_EMAIL;
  return { emails: count, cost: dollars(count * perEmail) };
}
