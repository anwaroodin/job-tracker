import { isPipelineVersion } from "~/types/cv";
import { obj, str } from "../cv/clean";
import type { NewRun, NewStage } from "../db/queries/runner-runs.server";

const ID = /^[0-9a-f-]{36}$/;
const KINDS = new Set(["tailor", "research", "prep", "stories"]);
const PROVIDERS = new Set(["claude", "antigravity"]);
const MAX_TOKENS = 10_000_000;

const count = (value: unknown, max = MAX_TOKENS) => (typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), max) : 0);
const percent = (value: unknown) => (typeof value === "number" && value >= 0 && value <= 100 ? value : null);
const dollars = (value: unknown) => (typeof value === "number" && value >= 0 && value < 1000 ? value : 0);
const optional = (value: unknown, max: number) => str(value, max) || null;

export const runId = (value: unknown) => (typeof value === "string" && ID.test(value) ? value : null);

export function runStart(raw: unknown, userId: string): NewRun | null {
  const r = obj(raw);
  const id = runId(r.id);
  const kind = str(r.kind, 20);
  if (!id || !KINDS.has(kind)) return null;
  const plan = obj(r.plan);
  return {
    id,
    userId,
    kind,
    applicationId: optional(r.applicationId, 64),
    roleCvId: optional(r.roleId, 64),
    pipeline: isPipelineVersion(r.pipeline) && r.pipeline !== "v1" ? r.pipeline : kind === "tailor" ? "v1" : null,
    model: str(r.model, 80) || "unknown",
    strategy: optional(r.strategy, 20),
    letter: typeof r.letter === "boolean" ? r.letter : null,
    fiveHourBefore: percent(plan.fiveHour),
    sevenDayBefore: percent(plan.sevenDay),
    startedAt: new Date().toISOString(),
  };
}

export function runStage(raw: unknown, id: string): NewStage {
  const r = obj(raw);
  const usage = obj(r.usage);
  return {
    id: crypto.randomUUID(),
    runId: id,
    stage: str(r.stage, 20) || "run",
    provider: PROVIDERS.has(str(r.provider, 20)) ? str(r.provider, 20) : "claude",
    model: str(usage.model, 80) || str(r.model, 80) || "unknown",
    effort: optional(r.effort, 10),
    ok: r.ok !== false,
    error: optional(r.error, 500),
    inputChars: count(r.inputChars),
    inputTokens: count(usage.inputTokens),
    cachedTokens: count(usage.cachedTokens),
    outputTokens: count(usage.outputTokens),
    costUsd: dollars(usage.costUsd),
    durationMs: count(r.durationMs, 3_600_000),
    createdAt: new Date().toISOString(),
  };
}

export function runFinish(raw: unknown) {
  const r = obj(raw);
  const plan = obj(r.plan);
  return {
    status: r.status === "done" ? "done" : "failed",
    error: optional(r.error, 500),
    fiveHourAfter: percent(plan.fiveHour),
    sevenDayAfter: percent(plan.sevenDay),
    finishedAt: new Date().toISOString(),
  };
}
