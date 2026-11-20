import { planUsage, runOnRunner } from "~/lib/runner";
import type { PipelineVersion, PlanUsage, RunnerUsage, TailorRequest } from "~/types/cv";

export type RunKind = "tailor" | "research" | "prep" | "stories";

export interface RunInfo {
  kind: RunKind;
  model: string;
  applicationId?: string;
  roleId?: string;
  pipeline?: PipelineVersion;
  strategy?: string;
  letter?: boolean;
}

export interface LoggedRun {
  id: string;
  before: PlanUsage | null;
}

function report(body: object) {
  return fetch("/api/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => undefined);
}

export async function startRun(info: RunInfo): Promise<LoggedRun> {
  const id = crypto.randomUUID();
  const before = await planUsage();
  await report({ action: "start", run: { id, ...info, plan: before } });
  return { id, before };
}

export async function runStage(run: LoggedRun, stage: string, request: TailorRequest): Promise<{ result: unknown; usage: RunnerUsage }> {
  const startedAt = Date.now();
  const details = { stage, provider: request.provider ?? "claude", model: request.model, effort: request.effort, inputChars: request.system.length + request.input.length };
  try {
    const reply = await runOnRunner(request);
    report({ action: "stage", runId: run.id, stage: { ...details, ok: true, usage: reply.usage, durationMs: Date.now() - startedAt } });
    return reply;
  } catch (e) {
    report({ action: "stage", runId: run.id, stage: { ...details, ok: false, error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - startedAt } });
    throw e;
  }
}

export async function finishRun(run: LoggedRun, error?: unknown): Promise<PlanUsage | null> {
  const after = await planUsage();
  const message = error === undefined ? undefined : error instanceof Error ? error.message : String(error);
  await report({ action: "finish", runId: run.id, finish: { status: error === undefined ? "done" : "failed", error: message, plan: after } });
  return after;
}

export async function runOnce(info: RunInfo, request: TailorRequest) {
  const run = await startRun(info);
  try {
    const reply = await runStage(run, info.kind, request);
    const after = await finishRun(run);
    return { ...reply, before: run.before, after };
  } catch (e) {
    await finishRun(run, e);
    throw e;
  }
}
