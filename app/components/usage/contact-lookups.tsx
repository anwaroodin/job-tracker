import { ListSection } from "~/components/applications/list-section";
import { SideBlock } from "~/components/ui/side-block";
import { formatDollars } from "~/lib/settings";
import type { loader } from "~/routes/app/usage";
import { Figure, Meter, SideNote, TwoColumns } from "./parts";

type Lookups = Awaited<ReturnType<typeof loader>>["outreach"];

const PROVIDERS: Record<string, { name: string; does: string }> = {
  brave: { name: "Brave Search", does: "Finds recruiters and hiring managers on LinkedIn" },
  generect: { name: "Generect", does: "Finds emails your mail server can't confirm, and people when search finds no one" },
};

export function ContactLookups({ lookups }: { lookups: Lookups }) {
  const main = (
    <ListSection title="This month">
      <ul className="flex flex-col">
        {lookups.map((p) => (
          <li key={p.provider} className="flex flex-col gap-2.5 border-b border-stroke-secondary py-4 first:pt-1 last:border-b-0">
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-text-primary">{PROVIDERS[p.provider]?.name ?? p.provider}</p>
                <p className="text-[12.5px] text-text-tertiary">{PROVIDERS[p.provider]?.does}</p>
              </div>
              <p className={p.overBudget ? "shrink-0 text-[13.5px] font-medium tabular-nums text-red-primary" : "shrink-0 text-[13.5px] font-medium tabular-nums text-text-primary"}>
                {formatDollars(p.cost)} <span className="font-normal text-text-tertiary">of {formatDollars(p.budget)}</span>
              </p>
            </div>
            <Meter share={p.budget > 0 ? p.cost / p.budget : 1} over={p.overBudget} />
            <p className="text-[12.5px] tabular-nums text-text-tertiary">
              {p.requests} {p.requests === 1 ? "request" : "requests"} · {p.found} found
              {p.overBudget && <span className="text-red-primary"> · Limit reached, paused until next month</span>}
            </p>
          </li>
        ))}
      </ul>
    </ListSection>
  );

  const total = lookups.reduce((sum, p) => sum + p.cost, 0);
  const aside = (
    <>
      <SideBlock title="Spent this month">
        <Figure label="All lookups" value={formatDollars(total)} />
        {lookups.map((p) => (
          <Figure key={p.provider} label={PROVIDERS[p.provider]?.name ?? p.provider} value={formatDollars(p.cost)} />
        ))}
      </SideBlock>
      <SideBlock title="Limits">
        <SideNote>
          Each service stops for the rest of the month once it reaches its limit. Checks on your own mail server are free and don't count. Change the limits with
          BRAVE_MONTHLY_BUDGET_USD and GENERECT_MONTHLY_BUDGET_USD.
        </SideNote>
      </SideBlock>
    </>
  );

  return <TwoColumns main={main} aside={aside} />;
}
