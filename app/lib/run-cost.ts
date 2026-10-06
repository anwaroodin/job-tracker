import type { RunnerUsage } from "~/types/cv";

export type LimitWindow = "fiveHour" | "sevenDay";
export type RunKind = "tailor" | "research";

export interface Calibration {
  fiveHour: { pct: number; usd: number };
  sevenDay: { pct: number; usd: number };
  lastCost: Partial<Record<RunKind, number>>;
}

const WINDOWS: LimitWindow[] = ["fiveHour", "sevenDay"];

export const totalOf = (stages: RunnerUsage[], key: "costUsd" | "inputTokens" | "outputTokens") => stages.reduce((n, s) => n + s[key], 0);

function observed(stages: RunnerUsage[], window: LimitWindow) {
  const readings = stages.map((s) => s[window]);
  if (readings.length < 2) return null;
  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i];
    const previous = readings[i - 1];
    if (reading === null || (i > 0 && previous !== null && reading < previous)) return null;
  }
  const usd = totalOf(stages, "costUsd") - (stages[0].costUsd + stages[stages.length - 1].costUsd) / 2;
  return usd > 0 ? { pct: readings[readings.length - 1]! - readings[0]!, usd } : null;
}

export function calibrate(previous: Calibration | undefined, stages: RunnerUsage[], kind: RunKind): Calibration {
  const base = previous ?? { fiveHour: { pct: 0, usd: 0 }, sevenDay: { pct: 0, usd: 0 }, lastCost: {} };
  const next: Calibration = { ...base, lastCost: { ...base.lastCost, [kind]: totalOf(stages, "costUsd") } };
  for (const window of WINDOWS) {
    const seen = observed(stages, window);
    if (seen) next[window] = { pct: base[window].pct + seen.pct, usd: base[window].usd + seen.usd };
  }
  return next;
}

export function estimatePct(calibration: Calibration | undefined, window: LimitWindow, costUsd: number) {
  const rate = calibration?.[window];
  return rate && rate.usd > 0 ? (costUsd * rate.pct) / rate.usd : null;
}
