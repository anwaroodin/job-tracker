import { index, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { application } from "./application";

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
    viewedAt: text("viewed_at"),
    dismissedAt: text("dismissed_at"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.applicationId] }),
    byApp: index("email_link_app_idx").on(t.applicationId, t.userId),
    // Every sync/status query filters by userId; without this, SQLite has no
    // index that starts with userId and falls back to driving the join from
    // email_message (the bigger table) instead of this one.
    byUser: index("email_link_user_idx").on(t.userId, t.id),
  }),
);

export const emailMessage = sqliteTable(
  "email_message",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: text("id").notNull(), // Gmail message id
    threadId: text("thread_id"),
    category: text("category").notNull(),
    confidence: real("confidence"),
    manualCategoryAt: text("manual_category_at"),
    manualKind: text("manual_kind"),
    detailsAt: text("details_at"),
    eventAt: text("event_at"),
    eventText: text("event_text"),
    actionUrl: text("action_url"),
    actionText: text("action_text"),
    needsReply: real("needs_reply"),
    replyDoneAt: text("reply_done_at"),
    suggestionAt: text("suggestion_at"),
    isApplication: real("is_application"),
    suggestedCompany: text("suggested_company"),
    suggestedRole: text("suggested_role"),
    suggestionConfidence: real("suggestion_confidence"),
    suggestionDismissedAt: text("suggestion_dismissed_at"),
    subject: text("subject").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    fromName: text("from_name").notNull().default(""),
    fromAddress: text("from_address").notNull().default(""),
    receivedAt: text("received_at").notNull(),
    // Set once an email is known not to be about jobs. Its content is cleared,
    // leaving only the id, thread and date, so sync knows it's been seen and
    // never downloads it again (see pruneUnrelatedEmails in email/retention.server.ts).
    prunedAt: text("pruned_at"),
    // The classifier that judged it unrelated. When a different one is in use,
    // the email is downloaded and judged again.
    prunedClassifier: text("pruned_classifier"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.id] }),
    byUserReceived: index("email_message_user_received_idx").on(
      t.userId,
      t.receivedAt,
    ),
    byUserThread: index("email_message_user_thread_idx").on(t.userId, t.threadId),
  }),
);

export type EmailLink = typeof emailLink.$inferSelect;
export type EmailMessage = typeof emailMessage.$inferSelect;
