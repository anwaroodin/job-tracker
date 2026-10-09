import { type ReactNode, useEffect, useState } from "react";
import { BarRow, Leader } from "~/components/ui/terminal";
import { calibrate, estimatePct, totalOf, usedPct, type Calibration, type LimitWindow, type Run, type RunKind } from "~/lib/run-cost";
import type { PlanUsage } from "~/types/cv";

const STORAGE_KEY = "job-tracker/claude-usage";

interface LastRun extends Run {
  model: string;
}

export function useRunCosts() {
  const [calibrations, setCalibrations] = useState<Record<string, Calibration>>({});
  const [last, setLast] = useState<LastRun | null>(null);

  useEffect(() => {
    try {
      setCalibrations(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
    } catch {}
  }, []);

  const record = (model: string, kind: RunKind, run: Run) => {
    setLast({ model, ...run });
    setCalibrations((previous) => {
      const next = { ...previous, [model]: calibrate(previous[model], run, kind) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return { calibrations, last, record };
}

const ADDED = "var(--color-text-primary)";
const LEVELS: [number, string][] = [
  [90, "var(--color-red-primary)"],
  [75, "var(--color-orange-primary)"],
  [0, "var(--color-green-primary)"],
];
const levelColor = (usedPct: number) => LEVELS.find(([floor]) => usedPct >= floor)![1];
const CELLS = 28;
const WINDOWS: { window: LimitWindow; label: string }[] = [
  { window: "fiveHour", label: "5-hour" },
  { window: "sevenDay", label: "Week" },
];

const tokens = (n: number) => `${Math.round(n / 1000)}k`;
const pct = (n: number) => `${Math.round(n)}%`;

function Heading({ children }: { children: ReactNode }) {
  return <p className="mb-1 mt-4 text-[10.5px] tracking-[0.1em] text-text-tertiary first:mt-0">{children}</p>;
}

function Change({ label, from, by, approx = false }: { label: string; from: number; by: number | null; approx?: boolean }) {
  const mark = approx ? "~" : "";
  return (
    <BarRow
      label={label}
      value={by === null ? pct(from) : by < 0.5 && approx ? "<1%" : `+${mark}${pct(by)}`}
      share={from}
      color={levelColor(from + (by ?? 0))}
      extra={by ? { share: by, color: ADDED } : undefined}
      cells={CELLS}
      valueClass="w-12"
      noteClass="w-28"
      note={by === null ? undefined : `${pct(from)} → ${mark}${pct(from + by)}`}
    />
  );
}

function Forecast({ label, now, costUsd, calibration }: { label: string; now: number; costUsd: number | undefined; calibration: Calibration | undefined }) {
  const next = costUsd === undefined ? null : estimatePct(calibration, "fiveHour", costUsd);
  return next === null ? null : <Change label={label} from={now} by={next} approx />;
}

export function RunCost({
  calibrations,
  model,
  researchModel,
  now,
  last,
}: {
  calibrations: Record<string, Calibration>;
  model: string;
  researchModel: string;
  now: PlanUsage | null;
  last: LastRun | null;
}) {
  const fiveHour = now?.fiveHour;
  return (
    <div className="max-w-2xl">
      {now && (
        <>
          <Heading>Claude limits</Heading>
          {WINDOWS.map(({ window, label }) => {
            const value = now[window];
            const run = last && last.after === now ? usedPct(last, window) : null;
            return value === null ? null : <Change key={window} label={label} from={run === null ? value : value - run} by={run} />;
          })}
        </>
      )}
      {fiveHour != null && (
        <>
          <Heading>Next run · 5-hour limit</Heading>
          <Forecast label="Tailoring" now={fiveHour} costUsd={calibrations[model]?.lastCost.tailor} calibration={calibrations[model]} />
          <Forecast label="Research" now={fiveHour} costUsd={calibrations[researchModel]?.lastCost.research} calibration={calibrations[researchModel]} />
        </>
      )}
      {last && (
        <>
          <Heading>Last run</Heading>
          <Leader label="Cost">${totalOf(last.stages, "costUsd").toFixed(2)} at API prices</Leader>
          <Leader label="Tokens">
            {tokens(totalOf(last.stages, "inputTokens"))} in · {tokens(totalOf(last.stages, "cachedTokens"))} cached ·{" "}
            {tokens(totalOf(last.stages, "outputTokens"))} out
          </Leader>
        </>
      )}
    </div>
  );
}
