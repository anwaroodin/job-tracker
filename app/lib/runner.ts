import type { PlanUsage, RunnerUsage, TailorRequest } from "~/types/cv";

const RUNNER_URL = "http://127.0.0.1:4317";

const MODEL_RANK = [/haiku/i, /sonnet/i];
const rank = (model: string) => {
  const i = MODEL_RANK.findIndex((pattern) => pattern.test(model));
  return i === -1 ? MODEL_RANK.length : i;
};

export const cheaperModel = (cap: string | undefined, chosen: string) => (cap && rank(cap) < rank(chosen) ? cap : chosen);

export const costKey = (model: string, pipeline: string) => (pipeline === "v1" ? model : `${model} · ${pipeline}`);

export async function runnerAvailable() {
  try {
    const res = await fetch(`${RUNNER_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runOnRunner(request: TailorRequest): Promise<{ result: unknown; usage: RunnerUsage }> {
  const res = await fetch(`${RUNNER_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await res.json()) as { result?: unknown; usage?: RunnerUsage; error?: string };
  if (!res.ok || body.result === undefined || !body.usage) throw new Error(body.error ?? `Runner failed (${res.status}). Restart it with npm run runner.`);
  return { result: body.result, usage: body.usage };
}

export async function planUsage(): Promise<PlanUsage | null> {
  try {
    const res = await fetch(`${RUNNER_URL}/usage`, { signal: AbortSignal.timeout(15_000) });
    return res.ok ? ((await res.json()) as PlanUsage) : null;
  } catch {
    return null;
  }
}
