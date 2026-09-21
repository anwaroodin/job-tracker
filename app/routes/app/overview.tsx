import { Link } from "react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { Route } from "./+types/overview";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/atoms/chart";
import { StatusBadge } from "~/components/molecules/status-badge";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { analyticsFor, type Analytics } from "~/server/db/analytics.server";
import { cn } from "~/lib/cn";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const analytics = await analyticsFor(getDb(env.DB), user.id);
  return { analytics };
}

const STATUS_COLORS: Record<string, string> = {
  applied: "var(--text-primary)",
  screening: "var(--text-secondary)",
  interview: "var(--orange-primary)",
  assessment: "var(--orange-primary)",
  offer: "var(--green-primary)",
  accepted: "var(--green-primary)",
  rejected: "var(--red-primary)",
  ghosted: "var(--stroke-primary)",
  withdrawn: "var(--stroke-primary)",
};

export default function Overview({ loaderData }: Route.ComponentProps) {
  const a = loaderData.analytics;
  const priorWeek = a.weekly[a.weekly.length - 2]?.count ?? 0;
  const thisWeek = a.weekly[a.weekly.length - 1]?.count ?? 0;
  const delta = thisWeek - priorWeek;

  return (
    <div className="flex flex-col">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="pb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
          Overview
        </p>
        <div className="mt-3 flex items-end justify-between gap-8 flex-wrap">
          <div>
            <h1 className="text-[64px] font-semibold leading-none tracking-[-0.03em] text-text-primary tabular-nums">
              {a.totals.total}
            </h1>
            <p className="mt-3 text-[13px] text-text-secondary">
              applications tracked · last one {a.totals.streakDays} day{a.totals.streakDays === 1 ? "" : "s"} ago
            </p>
          </div>

          <div className="flex items-stretch gap-8 divide-x divide-stroke-secondary [&>*:not(:first-child)]:pl-8">
            <InlineStat
              label="This week"
              value={a.totals.weekly}
              trend={
                delta === 0
                  ? undefined
                  : {
                      value: `${delta > 0 ? "+" : ""}${delta}`,
                      tone: delta > 0 ? "up" : "down",
                    }
              }
            />
            <InlineStat label="Active" value={a.totals.active} tone="neutral" />
            <InlineStat
              label="Offers"
              value={a.totals.offers}
              tone={a.totals.offers ? "up" : "neutral"}
            />
            <InlineStat
              label="Response rate"
              value={`${a.totals.responseRate}%`}
              tone={
                a.totals.responseRate >= 30 ? "up" : a.totals.responseRate >= 15 ? "neutral" : "down"
              }
            />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Hero chart ──────────────────────────────────────────────── */}
      <section className="py-10">
        <SectionLabel title="Application volume" sub="Last 12 weeks" />
        <div className="mt-5">
          <WeeklyChart data={a.weekly} />
        </div>
      </section>

      <Divider />

      {/* ── Status + Funnel ─────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-12 py-10 lg:grid-cols-2">
        <div>
          <SectionLabel title="Status" sub="Where every application sits" />
          <div className="mt-5">
            <StatusBreakdown data={a.byStatus} total={a.totals.total} />
          </div>
        </div>
        <div>
          <SectionLabel title="Funnel" sub="How far things progressed" />
          <div className="mt-5">
            <FunnelChart data={a.funnel} />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Top companies + CV split ────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-12 py-10 lg:grid-cols-[1fr_320px]">
        <div>
          <SectionLabel title="Top companies" sub="Where you've applied most" />
          <div className="mt-5">
            <TopCompanies data={a.topCompanies} total={a.totals.total} />
          </div>
        </div>
        <div>
          <SectionLabel title="CV split" sub="Software vs retail" />
          <div className="mt-5">
            <CvDonut data={a.byCv} total={a.totals.total} />
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Recent activity ─────────────────────────────────────────── */}
      <section className="pt-10 pb-4">
        <SectionLabel title="Recent activity" sub="Latest six applications" />
        <div className="mt-4">
          <RecentList rows={a.recent} />
        </div>
      </section>
    </div>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────

function Divider() {
  return <div className="h-px w-full bg-stroke-secondary" />;
}

function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">{title}</h2>
      {sub && <span className="text-[12px] text-text-tertiary">{sub}</span>}
    </div>
  );
}

function InlineStat({
  label,
  value,
  trend,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  trend?: { value: string; tone: "up" | "down" };
  tone?: "up" | "down" | "neutral";
}) {
  const toneColor =
    tone === "up"
      ? "text-green-primary"
      : tone === "down"
      ? "text-red-primary"
      : "text-text-primary";
  return (
    <div className="flex flex-col pr-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={cn("text-[22px] font-semibold leading-none tabular-nums", toneColor)}>{value}</span>
        {trend && (
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              trend.tone === "up" ? "text-green-primary" : "text-red-primary",
            )}
          >
            {trend.value}
          </span>
        )}
      </p>
    </div>
  );
}

// ── Weekly area chart ─────────────────────────────────────────────────────

function WeeklyChart({ data }: { data: Analytics["weekly"] }) {
  const config = {
    count: { label: "Applications", color: "var(--text-primary)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-56">
      <AreaChart data={data} margin={{ top: 4, left: -12, right: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="volume" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--text-primary)" stopOpacity={0.16} />
            <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--stroke-secondary)" />
        <XAxis
          dataKey="weekLabel"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          fontSize={11}
          interval="preserveStartEnd"
        />
        <YAxis
          width={28}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          fontSize={11}
          allowDecimals={false}
        />
        <ChartTooltip cursor={{ stroke: "var(--stroke-primary)", strokeDasharray: 4 }} content={<ChartTooltipContent labelKey="weekLabel" />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="var(--text-primary)"
          strokeWidth={1.5}
          fill="url(#volume)"
          activeDot={{ r: 4, strokeWidth: 0, fill: "var(--text-primary)" }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ── Status list (compact bars) ────────────────────────────────────────────

function StatusBreakdown({ data, total }: { data: Analytics["byStatus"]; total: number }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.status} className="flex items-center gap-4">
          <span className="w-24 shrink-0 text-[13px] capitalize text-text-primary">{d.status}</span>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-fill-tertiary">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${(d.count / max) * 100}%`,
                background: STATUS_COLORS[d.status] ?? "var(--text-tertiary)",
              }}
            />
          </div>
          <span className="w-10 text-right text-[12px] font-medium tabular-nums text-text-primary">
            {d.count}
          </span>
          <span className="w-10 text-right text-[11px] tabular-nums text-text-tertiary">
            {total ? Math.round((d.count / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────

function FunnelChart({ data }: { data: Analytics["funnel"] }) {
  if (data[0]?.count === 0) return <Empty />;
  const applied = data[0]?.count ?? 0;
  return (
    <div className="flex flex-col gap-4">
      {data.map((d, i) => {
        const pct = applied ? (d.count / applied) * 100 : 0;
        return (
          <div key={d.stage}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-text-primary">{d.stage}</span>
              <span className="tabular-nums text-text-secondary">
                <span className="text-text-primary">{d.count}</span>
                {i > 0 && <span className="ml-2 text-text-tertiary">{Math.round(pct)}%</span>}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill-tertiary">
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: i === data.length - 1 ? "var(--green-primary)" : "var(--text-primary)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top companies ─────────────────────────────────────────────────────────

function TopCompanies({ data, total }: { data: Analytics["topCompanies"]; total: number }) {
  if (data.length === 0) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col divide-y divide-stroke-secondary">
      {data.map((c) => (
        <div key={c.company} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-primary">{c.company}</span>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-fill-tertiary">
            <div className="h-full bg-text-primary" style={{ width: `${(c.count / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-[12px] font-medium tabular-nums text-text-primary">{c.count}</span>
          <span className="w-10 text-right text-[11px] tabular-nums text-text-tertiary">
            {total ? Math.round((c.count / total) * 100) : 0}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── CV donut ──────────────────────────────────────────────────────────────

function CvDonut({ data, total }: { data: Analytics["byCv"]; total: number }) {
  if (data.length === 0 || total === 0) return <Empty />;
  const palette = ["var(--text-primary)", "var(--orange-primary)", "var(--green-primary)", "var(--text-tertiary)"];
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.cvType, { label: d.cvType, color: palette[i % palette.length] }]),
  );
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <ChartContainer config={config} className="h-full w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="count"
              nameKey="cvType"
              innerRadius={44}
              outerRadius={62}
              strokeWidth={2}
              stroke="var(--bg-primary)"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-semibold leading-none tabular-nums text-text-primary">{total}</span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-text-tertiary">total</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {data.map((d, i) => (
          <div key={d.cvType} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: palette[i % palette.length] }} />
              <span className="text-[13px] capitalize text-text-primary">{d.cvType}</span>
            </div>
            <span className="text-[12px] tabular-nums text-text-secondary">
              <span className="text-text-primary">{d.count}</span>
              <span className="ml-2 text-text-tertiary">{Math.round((d.count / total) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recent list ───────────────────────────────────────────────────────────

function RecentList({ rows }: { rows: Analytics["recent"] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col divide-y divide-stroke-secondary">
      {rows.map((r) => (
        <li key={r.id} className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <Link
              to={`/applications/${r.id}`}
              className="text-[13px] font-medium text-text-primary transition-colors group-hover:text-text-secondary"
            >
              {r.company}
            </Link>
            <p className="mt-0.5 truncate text-[11.5px] text-text-secondary">{r.role}</p>
          </div>
          <StatusBadge status={r.status} />
          <span className="w-24 text-right text-[11.5px] tabular-nums text-text-tertiary">
            {new Date(r.appliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="text-[13px] text-text-tertiary">Not enough data yet.</p>;
}
