import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const gmailSync = sqliteTable("gmail_sync", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // everything received before this has been synced
  syncedThrough: text("synced_through"),
  lastRunAt: text("last_run_at"),
  lastError: text("last_error"),
  hasMore: integer("has_more", { mode: "boolean" }).notNull().default(false),
  classifier: text("classifier"),
  stage: text("stage"),
  stageCount: integer("stage_count"),
  lastFetched: integer("last_fetched"),
  lastLinked: integer("last_linked"),
  lastFinishedAt: text("last_finished_at"),
  matchedAt: text("matched_at"),
});

export type GmailSync = typeof gmailSync.$inferSelect;
