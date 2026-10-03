import { index, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  awaitsDetails,
  awaitsSuggestion,
  hasUpNextDetails,
  isStageEmail,
  isStub,
  isUnprunedOther,
  isUnreadLink,
} from "../predicates";
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
    unread: index("email_link_unread_idx").on(t.userId, t.applicationId).where(isUnreadLink(t)),
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
    stage: index("email_message_stage_idx").on(t.userId, t.receivedAt).where(isStageEmail(t)),
    awaitingSuggestion: index("email_message_awaiting_suggestion_idx").on(t.userId, t.receivedAt).where(awaitsSuggestion(t)),
    awaitingDetails: index("email_message_awaiting_details_idx").on(t.userId, t.receivedAt).where(awaitsDetails(t)),
    unprunedOther: index("email_message_unpruned_other_idx").on(t.userId, t.receivedAt).where(isUnprunedOther(t)),
    stubs: index("email_message_stub_idx").on(t.userId, t.prunedClassifier).where(isStub(t)),
    upNext: index("email_message_up_next_idx").on(t.userId, t.receivedAt).where(hasUpNextDetails(t)),
  }),
);

export type EmailLink = typeof emailLink.$inferSelect;
export type EmailMessage = typeof emailMessage.$inferSelect;
