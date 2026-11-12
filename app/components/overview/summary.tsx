import { PageTitle } from "~/components/ui/terminal";
import type { Analytics } from "~/types/analytics";
import { cn } from "~/lib/cn";
import { SideBlock } from "~/components/ui/side-block";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Verdict({ totals: t }: { totals: Analytics["totals"] }) {
  if (t.total === 0) return <PageTitle title="Nothing tracked yet" sub="Apply somewhere and it shows up here." />;
  const last = t.streakDays === 0 ? "Last one today." : `Last one ${plural(t.streakDays, "day")} ago.`;
  return <PageTitle title={plural(t.total, "application")} sub={`${t.responseRate}% heard back. ${last}`} />;
}

function Figure({ label, value, note, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13.5px] text-text-secondary">{label}</dt>
      <dd className="flex items-baseline gap-2">
        {note && <span className="text-[12.5px]">{note}</span>}
        <span className={cn("text-[22px] font-medium leading-none tabular-nums", tone ?? "text-text-primary")}>{value}</span>
      </dd>
    </div>
  );
}

export function Figures({ totals: t }: { totals: Analytics["totals"] }) {
  const delta = t.weekly - t.previousWeekly;
  return (
    <SideBlock title="At a glance">
      <dl className="flex flex-col gap-3">
        <Figure label="Still open" value={t.active} />
        <Figure label="Offers" value={t.offers} tone={t.offers ? "text-green-primary" : undefined} />
        <Figure
          label="Last 7 days"
          value={t.weekly}
          note={
            delta !== 0 && (
              <span className={delta > 0 ? "text-green-primary" : "text-red-primary"}>
                {delta > 0 ? "+" : "−"}
                {Math.abs(delta)} vs last week
              </span>
            )
          }
        />
      </dl>
    </SideBlock>
  );
}
