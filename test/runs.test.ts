import { describe, expect, it } from "vitest";
import { finishRun, insertRun, insertStage } from "~/server/db/queries/runner-runs.server";
import { runFinish, runStage, runStart } from "~/server/runs/input.server";
import { runAnalytics } from "~/server/services/runs/analytics.server";
import { USER_ID, testDb } from "./db";
import { addApplication } from "./fixtures";

const RUN_ID = "11111111-1111-4111-8111-111111111111";

describe("runner run analytics", () => {
  it("rejects malformed runs and clamps reported numbers", () => {
    expect(runStart({ id: "not-a-uuid", kind: "tailor" }, USER_ID)).toBeNull();
    expect(runStart({ id: RUN_ID, kind: "hack" }, USER_ID)).toBeNull();
    const stage = runStage({ stage: "diffs", provider: "evil", usage: { inputTokens: -5, outputTokens: 1e12, costUsd: "1" } }, RUN_ID);
    expect(stage).toMatchObject({ provider: "claude", inputTokens: 0, outputTokens: 10_000_000, costUsd: 0, ok: true });
  });

  it("totals each run's stages and averages them per pipeline, model and stage", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", company: "Acme" });
    await insertRun(db, runStart({ id: RUN_ID, kind: "tailor", model: "claude-opus-5-5", pipeline: "v2", applicationId: "app-1", plan: { fiveHour: 10, sevenDay: 40 } }, USER_ID)!);
    await insertStage(db, runStage({ stage: "plan", usage: { model: "claude-sonnet-5-5", inputTokens: 1000, cachedTokens: 200, outputTokens: 300, costUsd: 0.01 }, durationMs: 4000 }, RUN_ID));
    await insertStage(db, runStage({ stage: "diffs", usage: { model: "claude-opus-5-5", inputTokens: 5000, outputTokens: 2000, costUsd: 0.2 }, durationMs: 60_000 }, RUN_ID));
    await insertStage(db, runStage({ stage: "inject", ok: false, error: "timed out" }, RUN_ID));
    await finishRun(db, USER_ID, RUN_ID, runFinish({ status: "done", plan: { fiveHour: 13.5, sevenDay: 41 } }));

    const analytics = await runAnalytics(db, USER_ID);

    expect(analytics.recent[0]).toMatchObject({ label: "Acme", status: "done", fiveHourUsed: 3.5, sevenDayUsed: 1, stageCount: 3 });
    expect(analytics.recent[0].totals).toMatchObject({ inputTokens: 6000, cachedTokens: 200, outputTokens: 2300, durationMs: 64_000 });
    expect(analytics.variants).toEqual([expect.objectContaining({ kind: "tailor", pipeline: "v2", model: "claude-opus-5-5", runs: 1, done: 1, fiveHourPerRun: 3.5 })]);
    const inject = analytics.stages.find((s) => s.stage === "inject")!;
    expect([inject.kind, inject.pipeline, inject.calls, inject.failed]).toEqual(["tailor", "v2", 1, 1]);
    expect(analytics.stages.find((s) => s.stage === "plan")?.models).toEqual(["claude-sonnet-5-5"]);
  });
});
