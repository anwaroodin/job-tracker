import type { Db } from "../../db/client.server";
import { runsSince, stagesSince } from "../../db/queries/runner-runs.server";
import type { RunnerStage } from "../../db/schema";

const WINDOW_DAYS = 30;
const RECENT_RUNS = 15;

export interface Totals {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

const ZERO: Totals = { inputTokens: 0, cachedTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 };

const add = (a: Totals, b: Totals): Totals => ({
  inputTokens: a.inputTokens + b.inputTokens,
  cachedTokens: a.cachedTokens + b.cachedTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  costUsd: a.costUsd + b.costUsd,
  durationMs: a.durationMs + b.durationMs,
});

const average = (total: Totals, n: number): Totals =>
  n ? { inputTokens: total.inputTokens / n, cachedTokens: total.cachedTokens / n, outputTokens: total.outputTokens / n, costUsd: total.costUsd / n, durationMs: total.durationMs / n } : ZERO;

const used = (before: number | null, after: number | null) => (before === null || after === null || after < before ? null : after - before);

const mean = (values: (number | null)[]) => {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((sum, v) => sum + v, 0) / known.length : null;
};

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

export async function runAnalytics(db: Db, userId: string, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const [runs, stages] = await Promise.all([runsSince(db, userId, since), stagesSince(db, userId, since)]);
  const stagesByRun = groupBy(stages, (stage) => stage.runId);
  const totalsOf = (runStages: RunnerStage[] = []) => runStages.reduce(add, ZERO);

  const detailed = runs.map((run) => ({
    ...run,
    label: run.company ?? run.roleTitle ?? "",
    stageCount: stagesByRun.get(run.id)?.length ?? 0,
    totals: totalsOf(stagesByRun.get(run.id)),
    fiveHourUsed: used(run.fiveHourBefore, run.fiveHourAfter),
    sevenDayUsed: used(run.sevenDayBefore, run.sevenDayAfter),
  }));

  const variants = [...groupBy(detailed, (run) => `${run.kind}|${run.pipeline ?? ""}|${run.model}`).values()].map((group) => {
    const done = group.filter((run) => run.status === "done");
    return {
      kind: group[0].kind,
      pipeline: group[0].pipeline,
      model: group[0].model,
      runs: group.length,
      done: done.length,
      failed: group.filter((run) => run.status === "failed").length,
      perRun: average(done.map((run) => run.totals).reduce(add, ZERO), done.length),
      fiveHourPerRun: mean(done.map((run) => run.fiveHourUsed)),
      sevenDayPerRun: mean(done.map((run) => run.sevenDayUsed)),
    };
  });

  const runOf = new Map(runs.map((run) => [run.id, run]));
  const stageGroups = groupBy(stages, (stage) => `${runOf.get(stage.runId)?.kind}|${runOf.get(stage.runId)?.pipeline}|${stage.stage}`);
  const stageRows = [...stageGroups.values()].map((group) => {
    const ok = group.filter((stage) => stage.ok);
    const run = runOf.get(group[0].runId);
    return {
      kind: run?.kind ?? "",
      pipeline: run?.pipeline ?? null,
      stage: group[0].stage,
      calls: group.length,
      failed: group.length - ok.length,
      models: [...new Set(group.map((stage) => stage.model))],
      perCall: average(totalsOf(ok), ok.length),
      inputChars: ok.length ? ok.reduce((sum, stage) => sum + stage.inputChars, 0) / ok.length : 0,
    };
  });

  const summary = {
    runs: runs.length,
    done: runs.filter((run) => run.status === "done").length,
    failed: runs.filter((run) => run.status === "failed").length,
    totals: totalsOf(stages),
    fiveHourUsed: detailed.reduce((sum, run) => sum + (run.fiveHourUsed ?? 0), 0),
  };

  return { windowDays: WINDOW_DAYS, summary, variants, stages: stageRows, recent: detailed.slice(0, RECENT_RUNS) };
}

export type RunAnalytics = Awaited<ReturnType<typeof runAnalytics>>;
