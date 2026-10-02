import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { application } from "./application";

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    kind: text("kind").notNull(),
    applicationId: text("application_id").references(() => application.id, { onDelete: "cascade" }),
    emailId: text("email_id"),
    detail: text("detail"),
    seenAt: text("seen_at"),
  },
  (t) => ({
    byUserCreated: index("activity_user_created_idx").on(t.userId, t.createdAt),
    byApplication: index("activity_application_idx").on(t.applicationId),
    byUserUnseen: index("activity_user_unseen_idx").on(t.userId).where(sql`seen_at is null`),
  }),
);

export type Activity = typeof activity.$inferSelect;
