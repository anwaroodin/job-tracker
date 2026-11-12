import { PageSection } from "~/components/ui/page-section";
import { STATUS_COLORS, shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";

const STAGES = ["applied", "screening", "assessment", "interview", "offer"] as const;
const OUTCOMES = new Set(["rejected", "accepted", "withdrawn", "ghosted"]);
const DAY_MS = 86_400_000;

interface Stop {
  key: string;
  date: string | null;
  reached: boolean;
  current: boolean;
}

const daysBetween = (from: string, to: string | Date) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS));

function firstDates(
  emails: {
    category: string | null;
    receivedAt: string | null;
    unsure: boolean;
  }[],
) {
  const dates = new Map<string, string>();
  for (const e of emails) {
    if (!e.category || !e.receivedAt || e.unsure) continue;
    const seen = dates.get(e.category);
    if (!seen || e.receivedAt < seen) dates.set(e.category, e.receivedAt);
  }
  return dates;
}

function verdict(status: string, furthest: string, days: number) {
  const span = `${days} ${days === 1 ? "day" : "days"}`;
  if (status === "rejected") return `Rejected after ${span}. Got as far as ${furthest}.`;
  if (status === "accepted") return `Offer accepted after ${span}.`;
  if (status === "withdrawn") return `Withdrawn after ${span}, at ${furthest}.`;
  if (status === "ghosted") return `No reply for ${span}. Last stage: ${furthest}.`;
  if (status === "applied") return `Applied ${span} ago. Waiting to hear back.`;
  return `At the ${status} stage, ${span} after applying.`;
}

export function Journey({
  status,
  appliedAt,
  updatedAt,
  emails,
}: {
  status: string;
  appliedAt: string;
  updatedAt: string;
  emails: {
    category: string | null;
    receivedAt: string | null;
    unsure: boolean;
  }[];
}) {
  const dates = firstDates(emails);
  const outcome = OUTCOMES.has(status);
  const lastIndex = Math.max(...STAGES.map((s, i) => (s === status || dates.has(s) ? i : 0)));
  const stops: Stop[] = STAGES.map((stage, i) => ({
    key: stage,
    date: stage === "applied" ? appliedAt : (dates.get(stage) ?? null),
    reached: i <= lastIndex,
    current: stage === status,
  }));
  const outcomeDate = outcome ? (dates.get(status) ?? updatedAt) : null;
  if (outcome)
    stops.push({
      key: status,
      date: outcomeDate,
      reached: true,
      current: true,
    });
  const end = outcomeDate ?? new Date();

  return (
    <PageSection id="journey" title="Journey" description={verdict(status, STAGES[lastIndex], daysBetween(appliedAt, end))}>
      <ol
        className="flex flex-col gap-3 sm:grid sm:gap-0"
        style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}
      >
        {stops.map((stop, i) => {
          const next = stops[i + 1];
          const color = STATUS_COLORS[stop.key] ?? "var(--text-tertiary)";
          return (
            <li
              key={stop.key}
              className="grid min-w-0 grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-3 sm:flex sm:flex-col sm:items-stretch sm:gap-2.5"
              aria-current={stop.current ? "step" : undefined}
            >
              <span aria-hidden className="flex items-center">
                <span
                  className={cn("size-3 shrink-0 rounded-full border-2", stop.current && "ring-4 ring-ink/[0.07]")}
                  style={{
                    background: stop.reached ? color : "var(--bg-primary)",
                    borderColor: stop.reached ? color : "var(--stroke-primary)",
                  }}
                />
                {next && (
                  <span
                    className="mx-1.5 hidden h-0.5 flex-1 sm:block"
                    style={{ background: next.reached ? (STATUS_COLORS[next.key] ?? color) : "var(--stroke-secondary)" }}
                  />
                )}
              </span>
              <span
                className={cn(
                  "truncate pr-2 text-[13.5px] capitalize",
                  stop.current ? "font-medium text-text-primary" : stop.reached ? "text-text-secondary" : "text-text-tertiary",
                )}
              >
                {stop.key}
              </span>
              <span className="truncate pr-2 text-right text-[12.5px] tabular-nums text-text-tertiary sm:-mt-1.5 sm:text-left">
                {stop.date
                  ? `${shortDate(stop.date)}${i === 0 ? "" : ` · Day ${daysBetween(appliedAt, stop.date)}`}`
                  : stop.reached
                    ? "No email"
                    : "—"}
              </span>
            </li>
          );
        })}
      </ol>
    </PageSection>
  );
}
