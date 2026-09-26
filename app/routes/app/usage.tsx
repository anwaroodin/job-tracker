import { Link } from "react-router";
import type { Route } from "./+types/usage";
import { Bar, BarRow, ColumnChart, Leader, Section, fmtDate, pct, stagger } from "~/components/molecules/terminal";
import { cn } from "~/lib/cn";
import { formatDollars } from "~/lib/settings";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getSettings } from "~/server/db/settings.server";
import { usageDashboard } from "~/server/db/usage.server";
import { activeClassifier, jevAvailable } from "~/server/email/classifier.server";
import { DOLLARS_PER_INPUT_TOKEN } from "~/server/jev/client.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const settings = await getSettings(db, user.id);
  const usage = await usageDashboard(db, user.id, settings);
  return {
    usage,
    settings,
    jevOn: activeClassifier(env, settings).startsWith("jev"),
    jevAvailable: jevAvailable(env),
    pricePerMillion: DOLLARS_PER_INPUT_TOKEN * 1_000_000,
  };
}

export default function Usage({ loaderData }: Route.ComponentProps) {
  const { usage: u, settings, jevOn, pricePerMillion } = loaderData;
  const m = u.month;
  const budget = u.budget;
  const overBudget = budget !== null && m.cost >= budget;
  const peak = Math.max(...u.daily.map((d) => d.cost));
  const escalated = pct(m.bodies, m.emails);

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <b className="mr-2 font-semibold text-text-primary">[04]</b>Usage
        </p>
        <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
          <span className="text-text-primary">{formatDollars(m.cost)} spent on Jev this month.</span>
          <span className="block text-text-tertiary">
            {m.emails} {m.emails === 1 ? "email" : "emails"} classified.
          </span>
        </h1>
        <p className="mt-5 max-w-xl font-sans text-[16px] normal-case tracking-normal text-text-secondary">
          {jevOn ? (
            <>
              On pace for {formatDollars(m.projected)} by the end of the month
              {budget !== null && <>, against a {formatDollars(budget)} budget</>}.
            </>
          ) : (
            <>
              Jev is off, so emails are classified by the regex rules for free.{" "}
              <Link to="/settings#classification" className="text-accent-primary hover:text-accent-secondary">
                Change in settings
              </Link>
              .
            </>
          )}
        </p>
        {overBudget && (
          <p className="mt-3 font-sans text-[13px] normal-case tracking-normal text-red-primary">
            Monthly budget reached. New emails use the regex rules until next month.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-2">
        <Section n="02" title="Spend" hint={`$${pricePerMillion.toFixed(3)} / 1M input tokens`} i={1}>
          <Leader label="This month">{formatDollars(m.cost)}</Leader>
          <Leader label="Projected">{formatDollars(m.projected)}</Leader>
          <Leader label="Last month">{formatDollars(u.lastMonthCost)}</Leader>
          <Leader label="All time">{formatDollars(u.allTime.cost)}</Leader>
          <Leader label="Per 1,000 emails">{m.emails ? formatDollars(m.costPer1000) : "—"}</Leader>
          <Leader label="Budget">
            {budget === null ? (
              <Link to="/settings#classification" className="text-text-tertiary hover:text-text-primary">
                None set
              </Link>
            ) : (
              <span className={cn(overBudget && "text-red-primary")}>
                {formatDollars(m.cost)} / {formatDollars(budget)}
              </span>
            )}
          </Leader>
          {budget !== null && budget > 0 && (
            <div className="pt-2">
              <Bar
                share={(m.cost / budget) * 100}
                color={overBudget ? "var(--color-red-primary)" : "var(--color-accent-primary)"}
                cells={48}
              />
            </div>
          )}
        </Section>

        <Section n="03" title="Classification" hint="this month" i={2}>
          <Leader label="Requests">{m.requests}</Leader>
          <Leader label="Tokens per email">{m.tokensPerEmail || "—"}</Leader>
          <BarRow
            label="Read body"
            value={m.bodies}
            share={escalated}
            color="var(--color-accent-primary)"
            note={`${escalated}%`}
            cells={30}
          />
          <BarRow
            label="Unsure"
            value={u.emails.unsure}
            share={pct(u.emails.unsure, u.emails.byJev)}
            color="var(--color-accent-secondary)"
            note={`${pct(u.emails.unsure, u.emails.byJev)}%`}
            cells={30}
          />
          <BarRow
            label="Corrected"
            value={u.emails.corrected}
            share={pct(u.emails.corrected, u.emails.byJev)}
            color="var(--color-red-primary)"
            note={`${pct(u.emails.corrected, u.emails.byJev)}%`}
            cells={30}
          />
          <BarRow
            label="Confirmed"
            value={u.emails.confirmed}
            share={pct(u.emails.confirmed, u.emails.byJev)}
            color="var(--color-green-primary)"
            note={`${pct(u.emails.confirmed, u.emails.byJev)}%`}
            cells={30}
          />
          <p className="mt-3 font-sans text-[12px] normal-case leading-relaxed tracking-normal text-text-tertiary">
            Emails under {Math.round(settings.minConfidence * 100)}% confidence{" "}
            {settings.readBodies ? "get their full body read" : "stay unsure"}. Unsure, corrected and confirmed rates are out of{" "}
            {u.emails.byJev} emails Jev has classified.
          </p>
        </Section>
      </div>

      <Section n="04" title="Daily spend" hint={`30 days · peak ${formatDollars(peak)}`} i={3}>
        <ColumnChart
          peak={peak || 1}
          showValues={false}
          labelEvery={5}
          columns={u.daily.map((d) => ({
            key: d.day,
            label: fmtDate(d.day).slice(0, 6),
            value: d.cost,
            display: formatDollars(d.cost),
          }))}
        />
      </Section>

      <Section n="05" title="Requests" hint={u.allTime.since ? `since ${fmtDate(u.allTime.since)}` : undefined} i={4}>
        {u.recent.length === 0 ? (
          <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
            No Jev requests yet. They show up here after the next Gmail sync.
          </p>
        ) : (
          <ul className="-mx-3">
            <li className="grid grid-cols-[104px_1fr_auto_auto] gap-4 px-3 pb-2 text-[10.5px] tracking-[0.1em] text-text-tertiary sm:grid-cols-[150px_1fr_80px_80px_90px]">
              <span>When</span>
              <span>Read</span>
              <span className="text-right">Emails</span>
              <span className="hidden text-right sm:block">Tokens</span>
              <span className="text-right">Cost</span>
            </li>
            {u.recent.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[104px_1fr_auto_auto] items-baseline gap-4 px-3 py-2 sm:grid-cols-[150px_1fr_80px_80px_90px]"
              >
                <span className="text-text-tertiary">
                  {fmtDate(r.createdAt)}
                  <span className="hidden sm:inline"> {r.createdAt.slice(11, 16)}</span>
                </span>
                <span className={r.source === "body" ? "text-accent-primary" : "text-text-secondary"}>{r.source}</span>
                <span className="text-right tabular-nums text-text-primary">{r.emails}</span>
                <span className="hidden text-right tabular-nums text-text-secondary sm:block">
                  {r.inputTokens.toLocaleString("en-GB")}
                </span>
                <span className="text-right tabular-nums text-text-primary">{formatDollars(r.cost)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
