import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const runnerRun = sqliteTable(
  "runner_run",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    applicationId: text("application_id"),
    roleCvId: text("role_cv_id"),
    pipeline: text("pipeline"),
    model: text("model").notNull(),
    strategy: text("strategy"),
    letter: integer("letter", { mode: "boolean" }),
    status: text("status").notNull().default("running"),
    error: text("error"),
    version: integer("version"),
    fiveHourBefore: real("five_hour_before"),
    fiveHourAfter: real("five_hour_after"),
    sevenDayBefore: real("seven_day_before"),
    sevenDayAfter: real("seven_day_after"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (t) => ({
    byUserStarted: index("runner_run_user_started_idx").on(t.userId, t.startedAt),
  }),
);

export const runnerStage = sqliteTable(
  "runner_stage",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runnerRun.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    effort: text("effort"),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    error: text("error"),
    inputChars: integer("input_chars").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedTokens: integer("cached_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byRun: index("runner_stage_run_idx").on(t.runId),
  }),
);

export type RunnerRun = typeof runnerRun.$inferSelect;
export type RunnerStage = typeof runnerStage.$inferSelect;
