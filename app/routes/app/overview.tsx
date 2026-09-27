import type { Route } from "./+types/overview";
import { Link } from "react-router";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { analyticsFor } from "~/server/db/analytics.server";
import { upNext, type UpNext } from "~/server/db/emails.server";
import { eventLabel, formatEventAt } from "~/lib/email";
import { fmtAgo } from "~/lib/time";
import { useArrivals } from "~/lib/use-arrivals";
import { motion } from "motion/react";
import {
  Bar,
  BarRow,
  CV_COLORS,
  ColumnChart,
  Leader,
  Section,
  STATUS_COLORS,
  fmtDate,
  pct,
  stagger,
  two,
} from "~/components/molecules/terminal";
import { StatusBadge } from "~/components/molecules/status-badge";
import { cn } from "~/lib/cn";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [analytics, next] = await Promise.all([analyticsFor(db, user.id), upNext(db, user.id)]);
  return { analytics, next };
}

/**
 * Splits `cells` between counts in proportion (largest remainder method), so
 * the parts always add up to exactly `cells` and no count rounds away to more
 * than its share.
 */
function apportion(counts: number[], cells: number) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((n) => (n / total) * cells);
  const parts = exact.map(Math.floor);
  const leftover = cells - parts.reduce((sum, n) => sum + n, 0);
  const byRemainder = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < leftover; k++) parts[byRemainder[k][1]]++;
  return parts;
}

/** Every status in one glyph bar (`████▓▓▓░░`), with a legend of the largest few. */
function StackedStatusBar({ byStatus, cells = 34 }: { byStatus: { status: string; count: number }[]; cells?: number }) {
  const present = byStatus.filter((s) => s.count > 0);
  if (!present.length) return null;
  const widths = apportion(
    present.map((s) => s.count),
    cells,
  );
  const segments = present
    .map((s, i) => ({ status: s.status, color: STATUS_COLORS[s.status] ?? "#6e6f76", width: widths[i] }))
    .filter((s) => s.width > 0);
  const LEGEND = 4;

  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="block min-w-0 select-none overflow-hidden whitespace-pre tracking-[-0.05em]">
        {segments.map((s) => (
          <span key={s.status} style={{ color: s.color }}>
            {"█".repeat(s.width)}
          </span>
        ))}
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-tertiary">
        {segments.slice(0, LEGEND).map((s) => (
          <span key={s.status} className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: s.color }} />
            {s.status}
          </span>
        ))}
        {segments.length > LEGEND && <span>+{segments.length - LEGEND} more</span>}
      </div>
    </div>
  );
}

/** One figure in the header's ticker: `ACTIVE 12`. */
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

const TickerDivider = () => (
  <span aria-hidden className="select-none text-white/20">
    /
  </span>
);

export default function Overview({ loaderData }: Route.ComponentProps) {
  const a = loaderData.analytics;
  const t = a.totals;
  const delta = t.weekly - t.previousWeekly;
  const peak = Math.max(1, ...a.weekly.map((w) => w.count));
  const funnelMax = Math.max(1, a.funnel[0]?.count ?? 0);
  const statusMax = Math.max(1, ...a.byStatus.map((s) => s.count));
  const companyMax = Math.max(1, ...a.topCompanies.map((c) => c.count));
  const last =
    t.total === 0 ? "NOTHING TRACKED YET" : t.streakDays === 0 ? "LAST ONE TODAY" : `LAST ONE ${t.streakDays}D AGO`;
  const upNextTotal = loaderData.next.replies.length + loaderData.next.upcoming.length;
  // Sections are numbered in page order; Up next only appears when something's waiting.
  let section = 1;
  const next = () => two(++section);

  return (
    <div className="flex flex-col gap-10 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <b className="mr-2 font-semibold text-text-primary">[01]</b>Overview
        </p>

        <h1 className="mt-5 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
          <span className="text-text-primary">{t.total} applications tracked.</span>
          <span className="block text-text-tertiary">{last}.</span>
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-dashed border-white/15 py-3 text-[11px] tracking-[0.06em]">
          <Stat label="Active">
            <span className="font-semibold text-text-primary">{t.active}</span>
          </Stat>
          <TickerDivider />
          <Stat label="Offers">
            <span className={cn("font-semibold", t.offers ? "text-green-primary" : "text-text-primary")}>{t.offers}</span>
          </Stat>
          <TickerDivider />
          <Stat label="Response">
            <span className="font-semibold text-text-primary">{t.responseRate}%</span>
          </Stat>
          <TickerDivider />
          <Stat label="7d Trend">
            <span className="font-semibold text-text-primary">{t.weekly}</span>
            <span
              className={cn(
                "text-[10px]",
                delta > 0 ? "text-green-primary" : delta < 0 ? "text-red-primary" : "text-text-tertiary",
              )}
            >
              ({delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)})
            </span>
          </Stat>
          <TickerDivider />
          <Stat label="Rejected">
            <span className="font-semibold text-text-primary">{t.rejected}</span>
          </Stat>
          <TickerDivider />
          <Stat label="Up next">
            {upNextTotal === 0 ? (
              <span className="flex items-center gap-1.5 text-text-tertiary">
                <span className="size-1.5 rounded-full bg-green-primary/80" />
                all clear
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-accent-primary">
                <span className="size-1.5 animate-pulse rounded-full bg-accent-primary" />
                {upNextTotal} {upNextTotal === 1 ? "item" : "items"}
              </span>
            )}
          </Stat>
        </div>
      </header>

      {upNextTotal > 0 && <UpNextSection n={next()} next={loaderData.next} />}

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section n={next()} title="Funnel" hint="stage → stage" i={1}>
          {a.funnel.map((f, i) => (
            <BarRow
              key={f.stage}
              label={f.stage}
              value={f.count}
              share={(f.count / funnelMax) * 100}
              color={i === a.funnel.length - 1 ? "var(--color-green-primary)" : "#ececec"}
              note={i === 0 ? "100%" : `${pct(f.count, funnelMax)}%`}
              cells={34}
            />
          ))}
        </Section>

        <Section
          n={next()}
          title="Status"
          hint={`${a.byStatus.filter((s) => s.count > 0).length} active stages`}
          i={2}
        >
          <div className="mb-4 border-b border-dashed border-white/10 pb-3">
            <StackedStatusBar byStatus={a.byStatus} cells={34} />
          </div>
          {a.byStatus
            .filter((s) => s.count > 0)
            .map((s) => (
              <BarRow
                key={s.status}
                label={s.status}
                value={s.count}
                share={(s.count / statusMax) * 100}
                color={STATUS_COLORS[s.status] ?? "#6e6f76"}
                note={`${pct(s.count, t.total)}%`}
                cells={34}
              />
            ))}
        </Section>
      </div>

      {/* minmax(0, …): plain fr columns can't shrink below their content, and the glyph bars would push past the page. */}
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Section n={next()} title="Volume" hint={`12 weeks · peak ${peak}`} i={3}>
          <ColumnChart
            peak={peak}
            columns={a.weekly.map((w) => ({
              key: w.weekStart,
              label: w.weekLabel,
              value: w.count,
              display: String(w.count),
            }))}
          />
        </Section>

        <div className="flex flex-col gap-10">
          <Section n={next()} title="Top companies" hint="most applied" i={4}>
            {a.topCompanies.slice(0, 4).map((c, i) => (
              <Leader key={c.company} label={`${two(i + 1)}  ${c.company}`}>
                {/* inline-flex: Bar is a block, and would otherwise push the count onto its own line. */}
                <span className="inline-flex items-baseline gap-3">
                  <span className="hidden text-text-tertiary sm:inline">
                    <Bar share={(c.count / companyMax) * 100} color="#6e6f76" cells={10} />
                  </span>
                  {two(c.count)}
                </span>
              </Leader>
            ))}
          </Section>

          <Section n={next()} title="CV split" hint="which CV went out" i={5}>
            {a.byCv.map((c, i) => (
              <BarRow
                key={c.cvType}
                label={c.cvType}
                value={c.count}
                share={pct(c.count, t.total)}
                color={CV_COLORS[i % CV_COLORS.length]}
                note={`${pct(c.count, t.total)}%`}
                cells={34}
              />
            ))}
          </Section>
        </div>
      </div>

      <Section
        n={next()}
        title="Recent applications"
        hint={
          <Link to="/applications" className="text-accent-primary transition-colors hover:text-accent-secondary">
            View all ({t.total}) →
          </Link>
        }
        i={6}
      >
        <ul className="-mx-3 divide-y divide-dashed divide-stroke-primary/50">
          {a.recent.slice(0, 6).map((r) => (
            <li key={r.id}>
              <Link
                to={`/applications/${r.id}`}
                className="group grid grid-cols-[96px_1fr_auto] items-baseline gap-4 px-3 py-2 transition-colors hover:bg-text-primary hover:text-text-inverse"
              >
                <span className="text-text-tertiary group-hover:!text-text-inverse/60 text-[11px]">
                  {fmtDate(r.appliedAt)}
                </span>
                <span className="min-w-0 truncate">
                  <span className="text-text-primary group-hover:!text-text-inverse font-medium">
                    {r.company}
                  </span>
                  <span className="text-text-tertiary group-hover:!text-text-inverse/60">
                    {" "}/ {r.role}
                  </span>
                </span>
                <StatusBadge status={r.status} className="group-hover:!text-text-inverse" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function UpNextSection({ n, next }: { n: string; next: UpNext }) {
  const total = next.replies.length + next.upcoming.length;
  const isArrival = useArrivals([
    ...next.replies.map((r) => `reply-${r.emailId}`),
    ...next.upcoming.map((r) => `event-${r.emailId}`),
  ]);
  return (
    <Section n={n} title="Up next" hint={`${total} ${total === 1 ? "thing" : "things"}`} i={1}>
      <ul className="-mx-3 divide-y divide-dashed divide-stroke-primary/50">
        {next.replies.map((r) => (
          <UpNextRow
            key={`reply-${r.emailId}`}
            arrived={isArrival(`reply-${r.emailId}`)}
            to={`/applications/${r.applicationId}`}
            when={<span className="text-text-primary group-hover:!text-text-inverse">Reply needed</span>}
            company={r.company}
            detail={r.subject}
            note={fmtAgo(r.receivedAt)}
          />
        ))}
        {next.upcoming.map((r) => (
          <UpNextRow
            key={`event-${r.emailId}`}
            arrived={isArrival(`event-${r.emailId}`)}
            to={`/applications/${r.applicationId}`}
            when={formatEventAt(r.eventAt!)}
            company={r.company}
            detail={r.role}
            note={eventLabel(r.category)}
          />
        ))}
      </ul>
    </Section>
  );
}

function UpNextRow({
  to,
  when,
  company,
  detail,
  note,
  arrived,
}: {
  arrived: boolean;
  to: string;
  when: React.ReactNode;
  company: string;
  detail: string;
  note: string;
}) {
  return (
    <motion.li
      layout="position"
      initial={arrived ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(arrived && "arrive")}
    >
      <Link
        to={to}
        className="group grid grid-cols-[124px_1fr] items-baseline gap-4 px-3 py-2 transition-colors hover:bg-text-primary hover:text-text-inverse sm:grid-cols-[150px_1fr_auto]"
      >
        <span className="text-text-tertiary group-hover:!text-text-inverse/60">{when}</span>
        <span className="min-w-0 truncate">
          <span className="text-text-primary group-hover:!text-text-inverse">{company}</span>
          <span className="text-text-tertiary group-hover:!text-text-inverse/60"> / {detail}</span>
        </span>
        <span className="hidden text-text-tertiary group-hover:!text-text-inverse/60 sm:block">{note}</span>
      </Link>
    </motion.li>
  );
}
