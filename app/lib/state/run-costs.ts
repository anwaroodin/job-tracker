import { observable } from "@legendapp/state";
import { calibrate, type Calibration, type Run, type RunKind } from "~/lib/run-cost";
import type { PlanUsage } from "~/types/cv";

const STORAGE_KEY = "job-tracker/claude-usage";

export interface LastRun extends Run {
  model: string;
}

export const runCosts$ = observable<{ calibrations: Record<string, Calibration>; last: LastRun | null; now: PlanUsage | null }>({
  calibrations: {},
  last: null,
  now: null,
});

let loaded = false;

export function loadRunCosts() {
  if (loaded) return;
  loaded = true;
  try {
    runCosts$.calibrations.set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
  } catch {}
}

export function recordRunCost(model: string, kind: RunKind, run: Run) {
  loadRunCosts();
  const next = { ...runCosts$.calibrations.peek(), [model]: calibrate(runCosts$.calibrations[model].peek(), run, kind) };
  runCosts$.assign({ calibrations: next, last: { model, ...run }, now: run.after });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}
