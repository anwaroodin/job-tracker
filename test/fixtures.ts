import { application, emailLink, emailMessage, userSettings } from "~/server/db/schema";
import type { Db } from "~/server/db/client.server";
import { USER_ID } from "./db";

type ApplicationRow = typeof application.$inferInsert;
type EmailRow = typeof emailMessage.$inferInsert;

export const at = (day: number) => new Date(Date.UTC(2026, 8, day)).toISOString();

export async function addApplication(db: Db, row: Partial<ApplicationRow> & { id: string }) {
  await db.insert(application).values({
    userId: USER_ID,
    company: "Acme",
    role: "Engineer",
    status: "applied",
    appliedAt: at(1),
    updatedAt: at(1),
    ...row,
  });
}

export async function addEmail(db: Db, row: Partial<EmailRow> & { id: string }) {
  await db.insert(emailMessage).values({
    userId: USER_ID,
    threadId: row.id,
    category: "other",
    subject: `Subject ${row.id}`,
    snippet: `Snippet ${row.id}`,
    fromName: "Sender",
    fromAddress: "sender@example.com",
    receivedAt: at(2),
    ...row,
  });
}

export async function link(db: Db, emailId: string, applicationId: string, dismissedAt: string | null = null) {
  await db.insert(emailLink).values({ id: emailId, applicationId, userId: USER_ID, dismissedAt });
}

export async function setMinConfidence(db: Db, minConfidence: number) {
  await db.insert(userSettings).values({ userId: USER_ID, minConfidence });
}
