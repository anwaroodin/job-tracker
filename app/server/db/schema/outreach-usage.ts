import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const outreachUsage = sqliteTable(
  "outreach_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    action: text("action").notNull(),
    found: integer("found").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byCreated: index("outreach_usage_created_idx").on(t.createdAt, t.provider),
  }),
);
