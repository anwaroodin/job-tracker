import { useEffect, useState } from "react";
import { calibrate, estimatePct, totalOf, type Calibration, type RunKind } from "~/lib/run-cost";
import type { RunnerUsage } from "~/types/cv";

const STORAGE_KEY = "job-tracker/claude-usage";

interface LastRun {
  model: string;
  stages: RunnerUsage[];
}

export function useRunCosts() {
  const [calibrations, setCalibrations] = useState<Record<string, Calibration>>({});
  const [last, setLast] = useState<LastRun | null>(null);

  useEffect(() => {
    try {
      setCalibrations(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
    } catch {}
  }, []);

  const record = (model: string, kind: RunKind, stages: RunnerUsage[]) => {
    setLast({ model, stages });
    setCalibrations((previous) => {
      const next = { ...previous, [model]: calibrate(previous[model], stages, kind) };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return { calibrations, last, record };
}

const pct = (value: number | null) => (value === null ? "?" : value < 0.5 ? "under 1%" : `about ${Math.round(value)}%`);
const tokens = (n: number) => `${Math.round(n / 1000)}k`;

function limits(calibration: Calibration | undefined, costUsd: number) {
  return `${pct(estimatePct(calibration, "fiveHour", costUsd))} of your 5-hour limit and ${pct(estimatePct(calibration, "sevenDay", costUsd))} of your week`;
}

export function RunCost({ calibrations, model, last }: { calibrations: Record<string, Calibration>; model: string; last: LastRun | null }) {
  const calibration = calibrations[model];
  const tailorCost = calibration?.lastCost.tailor;
  const researchCost = calibration?.lastCost.research;
  const now = last?.stages[last.stages.length - 1];

  return (
    <div className="flex flex-col gap-1 font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
      {last && now && (
        <p>
          Last run: ${totalOf(last.stages, "costUsd").toFixed(2)} at API prices, {tokens(totalOf(last.stages, "inputTokens"))} tokens in and{" "}
          {tokens(totalOf(last.stages, "outputTokens"))} out, so {limits(calibrations[last.model], totalOf(last.stages, "costUsd"))}. You're now at{" "}
          {now.fiveHour ?? "?"}% of your 5-hour limit and {now.sevenDay ?? "?"}% of your week.
        </p>
      )}
      <p>
        {tailorCost === undefined && researchCost === undefined
          ? "Run once on this model to see how much of your Claude limits it uses."
          : [
              tailorCost !== undefined && `Tailoring on this model uses ${limits(calibration, tailorCost)}.`,
              researchCost !== undefined && `Company research uses ${limits(calibration, researchCost)}.`,
            ]
              .filter(Boolean)
              .join(" ")}
      </p>
    </div>
  );
}
