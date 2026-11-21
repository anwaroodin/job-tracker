import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";

export type SessionTarget = { kind: "count" | "minutes"; value: number };

export interface SessionJob {
  id: string;
  company: string;
  role: string;
}

export interface ApplySessionState {
  startedAt: number;
  endedAt: number | null;
  target: SessionTarget;
  applied: SessionJob[];
  dropped: string[];
  skippedAt: Record<string, number>;
  ticked: Record<string, string[]>;
}

export const SESSION_TARGETS: SessionTarget[] = [
  { kind: "count", value: 3 },
  { kind: "count", value: 5 },
  { kind: "minutes", value: 30 },
  { kind: "minutes", value: 60 },
];

export const targetLabel = (t: SessionTarget) => (t.kind === "count" ? `${t.value} applications` : `${t.value} minutes`);

export const applySession$ = observable<{ session: ApplySessionState | null }>({ session: null });

if (typeof window !== "undefined") {
  persistObservable(applySession$, { local: "job-tracker/apply-session/v1", pluginLocal: ObservablePersistLocalStorage });
}

export function startSession(target: SessionTarget) {
  applySession$.session.set({ startedAt: Date.now(), endedAt: null, target, applied: [], dropped: [], skippedAt: {}, ticked: {} });
}

export const endSession = () => applySession$.session.endedAt.set(Date.now());
export const clearSession = () => applySession$.session.set(null);
export const skipJob = (id: string) => applySession$.session.skippedAt[id].set(Date.now());

export function settleJob(job: SessionJob, outcome: "applied" | "dropped") {
  if (outcome === "applied") applySession$.session.applied.push(job);
  else applySession$.session.dropped.push(job.id);
}

export function toggleStep(jobId: string, step: string) {
  const steps = applySession$.session.ticked[jobId].peek() ?? [];
  applySession$.session.ticked[jobId].set(steps.includes(step) ? steps.filter((s) => s !== step) : [...steps, step]);
}

export function sessionProgress(session: ApplySessionState, now: number) {
  const minutes = ((session.endedAt ?? now) - session.startedAt) / 60_000;
  const share = session.target.kind === "count" ? session.applied.length / session.target.value : minutes / session.target.value;
  return { minutes, share: Math.min(1, share), reached: share >= 1 };
}
