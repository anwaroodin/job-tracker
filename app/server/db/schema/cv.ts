import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const cv = sqliteTable(
  "cv",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cvType: text("cv_type").notNull(),
    filename: text("filename").notNull(),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (t) => ({
    userTypeUnique: uniqueIndex("cv_user_type_unique").on(t.userId, t.cvType),
  }),
);

export type Cv = typeof cv.$inferSelect;
