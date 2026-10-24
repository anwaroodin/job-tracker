import { useSelector } from "@legendapp/state/react";
import { useEffect } from "react";
import { Bar } from "~/components/ui/terminal";
import { estimatePct, usedPct, type Calibration, type LimitWindow } from "~/lib/run-cost";
import { loadRunCosts, runCosts$, type LastRun } from "~/lib/state/run-costs";
import type { PlanUsage } from "~/types/cv";

export function useRunCosts() {
  useEffect(loadRunCosts, []);
  return useSelector(() => runCosts$.get());
}

const ADDED = "var(--color-text-primary)";
const LEVELS: [number, string][] = [
  [90, "var(--color-red-primary)"],
  [75, "var(--color-orange-primary)"],
  [0, "var(--color-green-primary)"],
];
const levelColor = (usedPct: number) => LEVELS.find(([floor]) => usedPct >= floor)![1];
const CELLS = 10;
const WINDOWS: { window: LimitWindow; label: string }[] = [
  { window: "fiveHour", label: "5-hour" },
  { window: "sevenDay", label: "Week" },
];

const pct = (n: number) => `${Math.round(n)}%`;

function Limit({ label, from, by }: { label: string; from: number; by: number | null }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {label}
      <Bar share={from} color={levelColor(from + (by ?? 0))} extra={by ? { share: by, color: ADDED } : undefined} cells={CELLS} />
      <span className="text-text-primary">{pct(from + (by ?? 0))}</span>
    </span>
  );
}

export function RunCost({ calibrations, model, now, last }: { calibrations: Record<string, Calibration>; model: string; now: PlanUsage | null; last: LastRun | null }) {
  if (!now) return null;
  const costUsd = calibrations[model]?.lastCost.tailor;
  const next = now.fiveHour === null || costUsd === undefined ? null : estimatePct(calibrations[model], "fiveHour", costUsd);
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[11px] text-text-tertiary">
      {WINDOWS.map(({ window, label }) => {
        const value = now[window];
        const run = last && last.after === now ? usedPct(last, window) : null;
        return value === null ? null : <Limit key={window} label={label} from={run === null ? value : value - run} by={run} />;
      })}
      {next !== null && (
        <span className="flex items-center gap-2 whitespace-nowrap">
          Next run <span className="text-text-secondary">≈ +{next < 0.5 ? "<1%" : pct(next)}</span>
        </span>
      )}
    </div>
  );
}
