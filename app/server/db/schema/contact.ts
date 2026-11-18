import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { application } from "./application";
import { user } from "./auth";

export const contact = sqliteTable(
  "contact",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    profileUrl: text("profile_url").notNull().default(""),
    leadId: text("lead_id"),
    degree: text("degree").notNull().default(""),
    headline: text("headline").notNull().default(""),
    note: text("note").notNull().default(""),
    email: text("email"),
    emailStatus: text("email_status"),
    emailSource: text("email_source"),
    emailCheckedAt: text("email_checked_at"),
    source: text("source").notNull().default("linkedin"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byApplicationProfile: uniqueIndex("contact_app_profile_idx").on(t.applicationId, t.profileUrl).where(sql`${t.profileUrl} <> ''`),
    byApplicationLead: uniqueIndex("contact_app_lead_idx").on(t.applicationId, t.leadId).where(sql`${t.leadId} is not null`),
    byUser: index("contact_user_idx").on(t.userId, t.applicationId),
  }),
);

export type ContactRow = typeof contact.$inferSelect;
