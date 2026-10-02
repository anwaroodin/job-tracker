import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const jevUsage = sqliteTable(
  "jev_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    source: text("source").notNull(),
    emails: integer("emails").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    model: text("model").notNull(),
  },
  (t) => ({
    byUserCreated: index("jev_usage_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type JevUsage = typeof jevUsage.$inferSelect;
