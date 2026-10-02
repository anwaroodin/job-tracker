import { ANALYTICS_CACHE, cached } from "../../cache.server";
import type { Db } from "../../db/client.server";
import { analyticsRows } from "../../db/queries/analytics.server";
import { deduplicateApplications } from "../applications/dedupe";
import { ACTIVE_STATUSES, OFFER_STATUSES } from "~/lib/status";
import type { Analytics } from "~/types/analytics";

// Every real write path (create/update/delete application, status refresh)
// invalidates this explicitly — the TTL only covers the case a cache entry
// lives in a different edge colo than the invalidation reached. Gmail sync
// itself only runs every 15-30min, so there's no reason for this to be short.
const ANALYTICS_TTL_SECONDS = 300;

const DAY_MS = 86_400_000;

function isoWeekStart(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

export async function analyticsFor(db: Db, userId: string): Promise<Analytics> {
  return cached(ANALYTICS_CACHE, userId, ANALYTICS_TTL_SECONDS, () => computeAnalytics(db, userId));
}

async function computeAnalytics(db: Db, userId: string): Promise<Analytics> {
  const rawRows = await analyticsRows(db, userId);

  const rows = deduplicateApplications(rawRows);

  const total = rows.length;
  const byStatusMap = new Map<string, number>();
  const byCvMap = new Map<string, number>();
  const byCompanyMap = new Map<string, number>();
  const weeksMap = new Map<string, number>();

  let active = 0;
  let offers = 0;
  let rejected = 0;
  let responded = 0;
  let weekly = 0;
  let previousWeekly = 0;
  let mostRecent = 0;

  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;

  for (const r of rows) {
    byStatusMap.set(r.status, (byStatusMap.get(r.status) ?? 0) + 1);
    byCvMap.set(r.cvType, (byCvMap.get(r.cvType) ?? 0) + 1);
    byCompanyMap.set(r.company, (byCompanyMap.get(r.company) ?? 0) + 1);

    const startOfWeek = isoWeekStart(new Date(r.appliedAt)).toISOString();
    weeksMap.set(startOfWeek, (weeksMap.get(startOfWeek) ?? 0) + 1);

    if (ACTIVE_STATUSES.has(r.status)) active++;
    if (OFFER_STATUSES.has(r.status)) offers++;
    if (r.status === "rejected") rejected++;
    if (r.status !== "applied" && r.status !== "ghosted") responded++;

    const t = Date.parse(r.appliedAt);
    if (t >= weekAgo) weekly++;
    else if (t >= twoWeeksAgo) previousWeekly++;
    if (t > mostRecent) mostRecent = t;
  }

  // 12 weekly buckets ending this week
  const weeks: { weekLabel: string; weekStart: string; count: number }[] = [];
  const thisWeek = isoWeekStart(new Date());

  for (let i = 11; i >= 0; i--) {
    const start = new Date(thisWeek.getTime() - i * 7 * DAY_MS);
    const isoStart = start.toISOString();
    weeks.push({
      weekLabel: start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      weekStart: isoStart,
      count: weeksMap.get(isoStart) ?? 0,
    });
  }

  const funnelCount = (statuses: string[]) =>
    statuses.reduce((sum, status) => sum + (byStatusMap.get(status) ?? 0), 0);

  return {
    totals: {
      total,
      active,
      offers,
      rejected,
      responseRate: total ? Math.round((responded / total) * 100) : 0,
      weekly,
      previousWeekly,
      streakDays: mostRecent
        ? Math.max(0, Math.floor((now - mostRecent) / DAY_MS))
        : 0,
    },
    byStatus: Array.from(byStatusMap, ([status, count]) => ({
      status,
      count,
    })).sort((a, b) => b.count - a.count),
    byCv: Array.from(byCvMap, ([cvType, count]) => ({ cvType, count })),
    weekly: weeks,
    funnel: [
      { stage: "Applied", count: total },
      {
        stage: "Screening",
        count: funnelCount([
          "screening",
          "interview",
          "assessment",
          "offer",
          "accepted",
        ]),
      },
      {
        stage: "Interview",
        count: funnelCount(["interview", "assessment", "offer", "accepted"]),
      },
      { stage: "Offer", count: funnelCount(["offer", "accepted"]) },
    ],
    topCompanies: Array.from(byCompanyMap, ([company, count]) => ({
      company,
      count,
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    recent: rows.slice(0, 6).map(({ id, company, role, status, appliedAt }) => ({ id, company, role, status, appliedAt })),
  };
}
