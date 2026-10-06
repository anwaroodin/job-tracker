import type { RunnerUsage, TailorRequest } from "~/types/cv";

const RUNNER_URL = "http://127.0.0.1:4317";

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
