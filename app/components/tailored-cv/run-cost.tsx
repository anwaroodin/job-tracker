import { useSelector } from "@legendapp/state/react";
import { useEffect } from "react";
import { Meter } from "~/components/ui/meter";
import { estimatePct, usedPct, type Calibration, type LimitWindow } from "~/lib/run-cost";
import { loadRunCosts, runCosts$, type LastRun } from "~/lib/state/run-costs";
import type { PlanUsage } from "~/types/cv";

export function useRunCosts() {
  useEffect(loadRunCosts, []);
  return useSelector(() => runCosts$.get());
}

const LEVELS: [number, string][] = [
  [90, "bg-red-primary"],
  [75, "bg-accent-primary"],
  [0, "bg-green-primary"],
];
const levelClass = (usedPct: number) => LEVELS.find(([floor]) => usedPct >= floor)![1];
const WINDOWS: { window: LimitWindow; label: string }[] = [
  { window: "fiveHour", label: "5 hours" },
  { window: "sevenDay", label: "This week" },
];

const pct = (n: number) => `${Math.round(n)}%`;

function Limit({ label, from, by }: { label: string; from: number; by: number | null }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {label}
      <span className="w-16">
        <Meter share={from} extra={by ?? undefined} className={levelClass(from + (by ?? 0))} />
      </span>
      <span className="font-medium tabular-nums text-text-primary">{pct(from + (by ?? 0))}</span>
    </span>
  );
}

export function RunCost({ calibrations, model, now, last }: { calibrations: Record<string, Calibration>; model: string; now: PlanUsage | null; last: LastRun | null }) {
  if (!now) return null;
  const costUsd = calibrations[model]?.lastCost.tailor;
  const next = now.fiveHour === null || costUsd === undefined ? null : estimatePct(calibrations[model], "fiveHour", costUsd);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-text-tertiary">
      <span>Plan usage</span>
      {WINDOWS.map(({ window, label }) => {
        const value = now[window];
        const run = last && last.after === now ? usedPct(last, window) : null;
        return value === null ? null : <Limit key={window} label={label} from={run === null ? value : value - run} by={run} />;
      })}
      {next !== null && (
        <span className="flex items-center gap-2 whitespace-nowrap">
          Next run <span className="font-medium tabular-nums text-text-primary">≈ +{next < 0.5 ? "<1%" : pct(next)}</span>
        </span>
      )}
    </div>
  );
}
