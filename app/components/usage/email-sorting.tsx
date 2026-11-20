import { Link } from "react-router";
import { ListSection } from "~/components/applications/list-section";
import { ColumnChart, pct, shortDate } from "~/components/ui/terminal";
import { SideBlock } from "~/components/ui/side-block";
import { formatDollars } from "~/lib/settings";
import type { loader } from "~/routes/app/usage";
import { DataTable, EmptyState, Figure, Meter, SideNote, TwoColumns, tokens } from "./parts";

type UsageData = Awaited<ReturnType<typeof loader>>;

const READ = { snippet: "Subject and preview", body: "Full email" } as Record<string, string>;

export function EmailSorting({ data }: { data: UsageData }) {
  const { usage: u, settings, jevOn, pricePerMillion } = data;
  const m = u.month;
  const budget = u.budget;
  const overBudget = budget !== null && m.cost >= budget;
  const peak = Math.max(...u.daily.map((d) => d.cost));
  const share = (n: number) => `${pct(n, u.emails.byJev)}%`;

  const main = (
    <>
      <ListSection title="Daily spend" count={`last 30 days · peak ${formatDollars(peak)}`}>
        <ColumnChart
          peak={peak || 1}
          showValues={false}
          labelEvery={5}
          columns={u.daily.map((d) => ({ key: d.day, label: shortDate(d.day), value: d.cost, display: formatDollars(d.cost) }))}
        />
      </ListSection>

      <ListSection title="Recent requests" count={u.allTime.requests || undefined}>
        {u.recent.length ? (
          <DataTable
            columns={[
              { label: "When", width: "minmax(110px,1fr)" },
              { label: "Read", width: "minmax(130px,1fr)" },
              { label: "Emails", width: "70px", align: "right" },
              { label: "Tokens", width: "80px", align: "right" },
              { label: "Cost", width: "90px", align: "right" },
            ]}
            rows={u.recent.map((r) => ({
              key: r.id,
              cells: [`${shortDate(r.createdAt)} ${r.createdAt.slice(11, 16)}`, READ[r.source] ?? r.source, r.emails, tokens(r.inputTokens), formatDollars(r.cost)],
            }))}
          />
        ) : (
          <EmptyState title="No Jev requests yet">They show up here after the next Gmail sync.</EmptyState>
        )}
      </ListSection>
    </>
  );

  const aside = (
    <>
      <SideBlock title="This month">
        <Figure label="Spent" value={formatDollars(m.cost)} />
        <Figure label="On pace for" value={formatDollars(m.projected)} />
        <Figure label="Last month" value={formatDollars(u.lastMonthCost)} />
        <Figure label="All time" value={formatDollars(u.allTime.cost)} />
        <Figure label="Per 1,000 emails" value={m.emails ? formatDollars(m.costPer1000) : "—"} />
        {budget === null ? (
          <SideNote>
            No monthly budget.{" "}
            <Link to="/settings#classification" className="font-medium text-text-secondary hover:text-text-primary">
              Set one
            </Link>
          </SideNote>
        ) : (
          <div className="flex flex-col gap-2">
            <Figure label="Budget" value={`${formatDollars(m.cost)} of ${formatDollars(budget)}`} tone={overBudget ? "bad" : undefined} />
            {budget > 0 && <Meter share={m.cost / budget} over={overBudget} />}
          </div>
        )}
        {overBudget && <p className="text-[12.5px] text-red-primary">Budget reached. New emails use the free rules until next month.</p>}
      </SideBlock>

      <SideBlock title="How emails were sorted">
        <Figure label="Requests" value={m.requests} />
        <Figure label="Tokens per email" value={m.tokensPerEmail || "—"} />
        <Figure label="Needed the full email" value={m.bodies} note={`${pct(m.bodies, m.emails)}%`} />
        <Figure label="Unsure" value={u.emails.unsure} note={share(u.emails.unsure)} />
        <Figure label="You corrected" value={u.emails.corrected} note={share(u.emails.corrected)} />
        <Figure label="You confirmed" value={u.emails.confirmed} note={share(u.emails.confirmed)} />
        <SideNote>
          Emails under {Math.round(settings.minConfidence * 100)}% confidence {settings.readBodies ? "get their full text read" : "stay unsure"}. The last three are out of{" "}
          {u.emails.byJev} emails Jev has sorted. Jev costs ${pricePerMillion.toFixed(3)} per million tokens read.
        </SideNote>
      </SideBlock>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {!jevOn && (
        <p className="border border-stroke-secondary px-4 py-2.5 text-[13.5px] text-text-secondary">
          Jev is off, so emails are sorted by the free rules.{" "}
          <Link to="/settings#classification" className="font-medium text-text-primary hover:underline">
            Change in settings
          </Link>
        </p>
      )}
      <TwoColumns main={main} aside={aside} />
    </div>
  );
}
