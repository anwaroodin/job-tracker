import type { PlanUsage, RunnerUsage } from "~/types/cv";

export type LimitWindow = "fiveHour" | "sevenDay";
export type RunKind = "tailor" | "research";

export interface Calibration {
  fiveHour: { pct: number; usd: number };
  sevenDay: { pct: number; usd: number };
  lastCost: Partial<Record<RunKind, number>>;
}

export interface Run {
  stages: RunnerUsage[];
  before: PlanUsage | null;
  after: PlanUsage | null;
}

const WINDOWS: LimitWindow[] = ["fiveHour", "sevenDay"];

export const totalOf = (stages: RunnerUsage[], key: keyof RunnerUsage) => stages.reduce((n, s) => n + s[key], 0);

export function usedPct(run: Run, window: LimitWindow) {
  const before = run.before?.[window];
  const after = run.after?.[window];
  return before == null || after == null || after < before ? null : after - before;
}

export function calibrate(previous: Calibration | undefined, run: Run, kind: RunKind): Calibration {
  const base = previous ?? { fiveHour: { pct: 0, usd: 0 }, sevenDay: { pct: 0, usd: 0 }, lastCost: {} };
  const usd = totalOf(run.stages, "costUsd");
  const next: Calibration = { ...base, lastCost: { ...base.lastCost, [kind]: usd } };
  for (const window of WINDOWS) {
    const pct = usedPct(run, window);
    if (pct !== null && usd > 0) next[window] = { pct: base[window].pct + pct, usd: base[window].usd + usd };
  }
  return next;
}

export function estimatePct(calibration: Calibration | undefined, window: LimitWindow, costUsd: number) {
  const rate = calibration?.[window];
  return rate && rate.usd > 0 ? (costUsd * rate.pct) / rate.usd : null;
}
