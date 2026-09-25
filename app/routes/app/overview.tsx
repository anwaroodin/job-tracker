import type { Route } from "./+types/overview";
import { Link } from "react-router";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { analyticsFor } from "~/server/db/analytics.server";
import { upNext, type UpNext } from "~/server/db/emails.server";
import { eventLabel, formatEventAt } from "~/lib/email";
import { fmtAgo } from "~/lib/time";
import { Bar, BarRow, CV_COLORS, ColumnChart, Leader, Section, STATUS_COLORS, fmtDate, pct, stagger, two } from "~/components/molecules/terminal";
import { StatusBadge } from "~/components/molecules/status-badge";
import { cn } from "~/lib/cn";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [analytics, next] = await Promise.all([analyticsFor(db, user.id), upNext(db, user.id)]);
  return { analytics, next };
}

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

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      {/* ── [01] ─────────────────────────────────────────────────── */}
      <header className="rise" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <b className="mr-2 font-semibold text-text-primary">[01]</b>Overview
        </p>
        <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
          <span className="text-text-primary">{t.total} applications tracked.</span>
          <span className="block text-text-tertiary">{last}.</span>
        </h1>
        <p className="mt-5 max-w-xl font-sans text-[16px] normal-case tracking-normal text-text-secondary">
          {t.active} in flight, {t.offers} {t.offers === 1 ? "offer" : "offers"} on the table, and {t.responseRate}% have
          heard back at all.
        </p>
      </header>

      {/* ── [02] ─────────────────────────────────────────────────── */}
      <UpNextSection next={loaderData.next} />

      {/* ── [03] + [04] ──────────────────────────────────────────── */}
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <Section n="03" title="Readout" hint="right now" i={2}>
          <Leader label="Last 7 days">
            {t.weekly}
            <span className={cn("ml-3", delta > 0 ? "text-green-primary" : delta < 0 ? "text-red-primary" : "text-text-tertiary")}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)} vs prev
            </span>
          </Leader>
          <Leader label="Active">{t.active}</Leader>
          <Leader label="Offers">
            <span className={t.offers ? "text-green-primary" : undefined}>{t.offers}</span>
          </Leader>
          <Leader label="Response rate">{t.responseRate}%</Leader>
          <Leader label="Rejected">{t.rejected}</Leader>
        </Section>

        <Section n="04" title="Funnel" hint="stage → stage" i={3}>
          {a.funnel.map((f, i) => (
            <BarRow
              key={f.stage}
              label={f.stage}
              value={f.count}
              share={(f.count / funnelMax) * 100}
              color={i === a.funnel.length - 1 ? "var(--color-green-primary)" : "#ececec"}
              note={i === 0 ? "" : `${pct(f.count, funnelMax)}%`}
              cells={34}
            />
          ))}
        </Section>
      </div>

      {/* ── [05] ─────────────────────────────────────────────────── */}
      <Section n="05" title="Volume" hint={`12 weeks · peak ${peak}`} i={4}>
        <ColumnChart
          peak={peak}
          columns={a.weekly.map((w) => ({ key: w.weekStart, label: w.weekLabel, value: w.count, display: String(w.count) }))}
        />
      </Section>

      {/* ── [06] + [07] + [08] ───────────────────────────────────── */}
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <Section n="06" title="Status" hint="where everything sits" i={5}>
          {a.byStatus.map((s) => (
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

        <div className="flex flex-col gap-12">
          <Section n="07" title="Top companies" hint="most applied" i={6}>
            {a.topCompanies.map((c, i) => (
              <Leader key={c.company} label={`${two(i + 1)}  ${c.company}`}>
                <span className="mr-4 hidden text-text-tertiary sm:inline">
                  <Bar share={(c.count / companyMax) * 100} color="#6e6f76" cells={10} />
                </span>
                {two(c.count)}
              </Leader>
            ))}
          </Section>

          <Section n="08" title="CV split" hint="which CV went out" i={7}>
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

      {/* ── [09] ─────────────────────────────────────────────────── */}
      <Section
        n="09"
        title="Log"
        hint={
          <Link to="/applications" className="text-accent-primary transition-colors hover:text-accent-secondary">
            View all →
          </Link>
        }
        i={8}
      >
        <ul className="-mx-3">
          {a.recent.map((r) => (
            <li key={r.id}>
              <Link
                to={`/applications/${r.id}`}
                className="group grid grid-cols-[104px_1fr_auto] items-baseline gap-4 px-3 py-2 transition-colors hover:bg-text-primary hover:text-text-inverse"
              >
                <span className="text-text-tertiary group-hover:!text-text-inverse/60">{fmtDate(r.appliedAt)}</span>
                <span className="min-w-0 truncate">
                  <span className="text-text-primary group-hover:!text-text-inverse">{r.company}</span>
                  <span className="text-text-tertiary group-hover:!text-text-inverse/60"> / {r.role}</span>
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

function UpNextSection({ next }: { next: UpNext }) {
  const total = next.replies.length + next.upcoming.length;
  return (
    <Section n="02" title="Up next" hint={total ? `${total} ${total === 1 ? "thing" : "things"}` : "all clear"} i={1}>
      {total === 0 ? (
        <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
          Nothing waiting on you. Replies and upcoming interviews or deadlines from your emails show up here.
        </p>
      ) : (
        <ul className="-mx-3">
          {next.replies.map((r) => (
            <UpNextRow
              key={`reply-${r.emailId}`}
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
              to={`/applications/${r.applicationId}`}
              when={formatEventAt(r.eventAt!)}
              company={r.company}
              detail={r.role}
              note={eventLabel(r.category)}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function UpNextRow({
  to,
  when,
  company,
  detail,
  note,
}: {
  to: string;
  when: React.ReactNode;
  company: string;
  detail: string;
  note: string;
}) {
  return (
    <li>
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
    </li>
  );
}
