import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { application } from "./application";
import { user } from "./auth";

export const shareLink = sqliteTable(
  "share_link",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    includeCv: integer("include_cv", { mode: "boolean" }).notNull().default(true),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byToken: uniqueIndex("share_link_token_unique").on(t.tokenHash),
    byApplication: uniqueIndex("share_link_application_unique").on(t.userId, t.applicationId),
  }),
);
