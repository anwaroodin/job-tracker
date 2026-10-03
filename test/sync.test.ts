import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { REGEX_CLASSIFIER } from "~/server/email/classify/index.server";
import type { Db } from "~/server/db/client.server";
import { application, emailLink, emailMessage, gmailSync, userSettings } from "~/server/db/schema";
import { setEmailCategory } from "~/server/db/queries/emails.server";
import { getMessagesMetadata, listMessageIds } from "~/server/gmail/client.server";
import type { GmailMessage } from "~/server/gmail/mapping.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { planLinksAndStatuses } from "~/server/gmail/sync/plan.server";
import { USER_ID, testDb } from "./db";
import { addApplication } from "./fixtures";

const current = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("~/server/db/client.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDb: () => current.db,
}));
vi.mock("~/server/auth/config.server", () => ({
  createAuth: () => ({ api: { getAccessToken: async () => ({ accessToken: "token" }) } }),
}));
vi.mock("~/server/cache.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  invalidate: vi.fn(),
}));
vi.mock("~/server/gmail/client.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMessageIds: vi.fn(),
  getMessagesMetadata: vi.fn(),
  getMessageBodies: vi.fn(async () => new Map()),
  getMailboxAddress: vi.fn(async () => "me@example.com"),
}));

const newsletter: GmailMessage = {
  id: "m1",
  threadId: "t1",
  subject: "Your weekly digest",
  snippet: "Top stories this week",
  fromName: "News",
  fromAddress: "news@example.com",
  receivedAt: new Date().toISOString(),
  sent: false,
};

function connectedGmail() {
  const { db, sqlite } = testDb();
  sqlite
    .prepare(
      "insert into account (id, account_id, provider_id, user_id, scope, created_at, updated_at) values ('acc', 'g', 'google', ?, ?, 0, 0)",
    )
    .run(USER_ID, `openid ${GMAIL_SCOPE}`);
  current.db = db;
  return db;
}

async function stored(db: Db) {
  const [row] = await db.select().from(emailMessage).where(eq(emailMessage.id, "m1"));
  return row;
}

beforeEach(() => {
  vi.mocked(listMessageIds).mockResolvedValue({ ids: ["m1"], truncated: false });
  vi.mocked(getMessagesMetadata).mockResolvedValue({ messages: [newsletter], missing: [], failed: [] });
});

describe("syncGmail retention", () => {
  it("prunes a non-job email judged by keyword rules and records that", async () => {
    const db = connectedGmail();
    const result = await syncGmail({ DB: {} } as Env, USER_ID, "manual");
    expect(result.error).toBeUndefined();
    expect(await stored(db)).toMatchObject({ subject: "", category: "other", prunedClassifier: REGEX_CLASSIFIER });
  });

  it("marks stubs for re-fetching when a job email joins their thread", async () => {
    const db = connectedGmail();
    await db.insert(emailMessage).values({
      userId: USER_ID,
      id: "stub",
      threadId: "t1",
      category: "other",
      receivedAt: new Date(Date.now() - 86_400_000).toISOString(),
      prunedAt: new Date().toISOString(),
      prunedClassifier: REGEX_CLASSIFIER,
    });
    vi.mocked(getMessagesMetadata).mockResolvedValue({
      messages: [{ ...newsletter, subject: "Interview invitation", snippet: "We'd like to invite you to an interview" }],
      missing: [],
      failed: [],
    });
    await syncGmail({ DB: {} } as Env, USER_ID, "manual");
    const [stub] = await db.select().from(emailMessage).where(eq(emailMessage.id, "stub"));
    expect(stub.prunedClassifier).toBe("thread");
  });

  it("records keyword rules as the judge when Jev is over budget (bug 2.1)", async () => {
    const db = connectedGmail();
    await db.insert(userSettings).values({ userId: USER_ID, monthlyBudget: 0 });
    const result = await syncGmail({ DB: {}, TYPESAFE_API_KEY: "key" } as Env, USER_ID, "manual");
    expect(result.error).toBeUndefined();
    expect(await stored(db)).toMatchObject({ subject: "", prunedClassifier: REGEX_CLASSIFIER });
  });
});

describe("syncGmail matching", () => {
  const interview: GmailMessage = {
    ...newsletter,
    id: "m2",
    threadId: "t2",
    subject: "Interview invitation",
    snippet: "We'd like to invite you to an interview at Acme",
    fromName: "Acme Recruiting",
    fromAddress: "jobs@acme.com",
  };

  async function syncAgainWithNoNewMail(db: Db) {
    await db.update(gmailSync).set({ lastRunAt: "2000-01-01T00:00:00.000Z" });
    vi.mocked(listMessageIds).mockResolvedValue({ ids: [], truncated: false });
    vi.mocked(getMessagesMetadata).mockResolvedValue({ messages: [], missing: [], failed: [] });
    await syncGmail({ DB: {} } as Env, USER_ID, "manual");
  }

  async function matchedAt(db: Db) {
    const [row] = await db.select({ matchedAt: gmailSync.matchedAt }).from(gmailSync);
    return row.matchedAt;
  }

  it("matches an email to an application added after it arrived", async () => {
    const db = connectedGmail();
    vi.mocked(getMessagesMetadata).mockResolvedValue({ messages: [interview], missing: [], failed: [] });
    await syncGmail({ DB: {} } as Env, USER_ID, "manual");
    expect(await db.select().from(emailLink)).toEqual([]);

    const now = new Date().toISOString();
    await addApplication(db, { id: "app-1", company: "Acme", appliedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), updatedAt: now });
    await syncAgainWithNoNewMail(db);
    expect((await db.select().from(emailLink)).map((l) => l.applicationId)).toEqual(["app-1"]);
  });

  it("doesn't match again when nothing changed since the last match", async () => {
    const db = connectedGmail();
    await syncGmail({ DB: {} } as Env, USER_ID, "manual");
    const first = await matchedAt(db);
    expect(first).not.toBeNull();
    await syncAgainWithNoNewMail(db);
    expect(await matchedAt(db)).toBe(first);
  });

  it("doesn't match again just because the last sync changed a status", async () => {
    const db = connectedGmail();
    await addApplication(db, { id: "app-1", company: "Acme", appliedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() });
    vi.mocked(getMessagesMetadata).mockResolvedValue({ messages: [interview], missing: [], failed: [] });
    await syncGmail({ DB: {} } as Env, USER_ID, "manual");
    const first = await matchedAt(db);
    const [app] = await db.select().from(application);
    expect(app.status).toBe("interview");
    expect(app.updatedAt <= first!).toBe(true);
    await syncAgainWithNoNewMail(db);
    expect(await matchedAt(db)).toBe(first);
  });

  it("matches again after an email is labelled by hand", async () => {
    const db = connectedGmail();
    await syncGmail({ DB: {} } as Env, USER_ID, "manual");
    await setEmailCategory(db, USER_ID, "m1", "interview");
    expect(await matchedAt(db)).toBeNull();
  });
});

describe("planLinksAndStatuses", () => {
  it("never links an email to a saved posting", () => {
    const email = { id: "e1", category: "interview", subject: "Interview with Murphy AI", snippet: "", fromName: "Murphy AI", fromAddress: "jobs@murphy.ai", receivedAt: "2026-09-10T00:00:00.000Z", manualCategoryAt: null, confidence: 0.99 } as Parameters<typeof planLinksAndStatuses>[0][number];
    const saved = { id: "saved", company: "Murphy AI", role: "Engineer", appliedAt: "2026-09-09T00:00:00.000Z", status: "saved", manualStatusAt: null };
    expect(planLinksAndStatuses([email], [saved], [], 0.5)).toEqual({ links: [], statusChanges: [] });
    expect(planLinksAndStatuses([email], [{ ...saved, status: "applied" }], [], 0.5).links).toHaveLength(1);
  });
});
