import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { application } from "./application";
import { user } from "./auth";

export const tailoredCv = sqliteTable(
  "tailored_cv",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    json: text("json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byApplication: index("tailored_cv_application_idx").on(t.userId, t.applicationId, t.version),
  }),
);
