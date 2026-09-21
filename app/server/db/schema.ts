/**
 * Drizzle schema for job-tracker.
 *
 * Regenerate migrations after editing this file:
 *   npm run db:generate
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ── Better Auth core tables ──────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ── App tables ───────────────────────────────────────────────────────────

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
    autoFilled: integer("auto_filled", { mode: "boolean" })
      .notNull()
      .default(true),
    assessmentDue: text("assessment_due"),
    assessmentCompleted: integer("assessment_completed", { mode: "boolean" }),
    appliedAt: text("applied_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    byUserApplied: index("app_user_applied_idx").on(t.userId, t.appliedAt),
    byUserStatus: index("app_user_status_idx").on(t.userId, t.status),
  }),
);

export const emailLink = sqliteTable(
  "email_link",
  {
    id: text("id").notNull(), // Gmail message id
    applicationId: text("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: text("subject"),
    snippet: text("snippet"),
    fromAddress: text("from_address"),
    receivedAt: text("received_at"),
    viewedAt: text("viewed_at"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.applicationId] }),
    byApp: index("email_link_app_idx").on(t.applicationId),
  }),
);

// ── Type exports ─────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type Cv = typeof cv.$inferSelect;
export type Application = typeof application.$inferSelect;
export type NewApplication = typeof application.$inferInsert;
export type EmailLink = typeof emailLink.$inferSelect;
