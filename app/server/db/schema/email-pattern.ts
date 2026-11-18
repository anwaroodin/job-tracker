import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const emailPattern = sqliteTable(
  "email_pattern",
  {
    domain: text("domain").notNull(),
    pattern: text("pattern").notNull(),
    confirmations: integer("confirmations").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.domain, t.pattern] }),
  }),
);
