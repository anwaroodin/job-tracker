import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const profile = sqliteTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  contactEmail: text("contact_email"),
  phone: text("phone"),
  addressJson: text("address_json")
    .notNull()
    .default(sql`'{}'`),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  eligibilityJson: text("eligibility_json")
    .notNull()
    .default(sql`'{}'`),
  softwareCvJson: text("software_cv_json")
    .notNull()
    .default(sql`'{}'`),
  retailCvJson: text("retail_cv_json")
    .notNull()
    .default(sql`'{}'`),
  softwareKeywordsJson: text("software_keywords_json")
    .notNull()
    .default(sql`'[]'`),
  retailKeywordsJson: text("retail_keywords_json")
    .notNull()
    .default(sql`'[]'`),
  gmailEmail: text("gmail_email"),
  gmailRefreshToken: text("gmail_refresh_token"),
  gmailClientId: text("gmail_client_id"),
  gmailClientSecret: text("gmail_client_secret"),
  updatedAt: text("updated_at").notNull(),
});

export type Profile = typeof profile.$inferSelect;
