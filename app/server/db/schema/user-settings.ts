import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  classifier: text("classifier").notNull().default("jev"),
  minConfidence: real("min_confidence").notNull().default(0.8),
  readBodies: integer("read_bodies", { mode: "boolean" }).notNull().default(true),
  extractDetails: integer("extract_details", { mode: "boolean" }).notNull().default(true),
  suggestApplications: integer("suggest_applications", { mode: "boolean" }).notNull().default(true),
  monthlyBudget: real("monthly_budget"),
  autoSync: integer("auto_sync", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at"),
});

export type UserSettings = typeof userSettings.$inferSelect;
