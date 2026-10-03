import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const application = sqliteTable(
  "application",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    url: text("url").notNull().default(""),
    cvType: text("cv_type").notNull().default("software"),
    status: text("status").notNull().default("applied"),
    category: text("category"),
    salary: text("salary").notNull().default(""),
    location: text("location").notNull().default(""),
    workType: text("work_type").notNull().default(""),
    notes: text("notes").notNull().default(""),
    // Job description captured by the browser extension when applying.
    description: text("description").notNull().default(""),
    // Listing facts captured with the posting: "Full-time", when it went up, "Over 100 applicants".
    employmentType: text("employment_type").notNull().default(""),
    postedAt: text("posted_at"),
    applicants: text("applicants").notNull().default(""),
    // People the listing suggests reaching out to (LinkedIn's "People you can
    // reach out to"), as a JSON array of Contact (app/lib/contacts.ts).
    contactsJson: text("contacts_json")
      .notNull()
      .default(sql`'[]'`),
    starred: integer("starred", { mode: "boolean" }).notNull().default(false),
    autoFilled: integer("auto_filled", { mode: "boolean" })
      .notNull()
      .default(true),
    manualStatusAt: text("manual_status_at"),
    appliedAt: text("applied_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byUserApplied: index("app_user_applied_idx").on(t.userId, t.appliedAt),
    byUserStatus: index("app_user_status_idx").on(t.userId, t.status),
    byUserUpdated: index("app_user_updated_idx").on(t.userId, t.updatedAt),
    byUserUrl: index("app_user_url_idx").on(t.userId, t.url, t.appliedAt),
    byUserCompanyRole: index("app_user_company_role_idx").on(t.userId, sql`lower(${t.company})`, sql`lower(${t.role})`, t.appliedAt),
  }),
);

export type Application = typeof application.$inferSelect;
export type NewApplication = typeof application.$inferInsert;
