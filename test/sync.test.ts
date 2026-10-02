import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { REGEX_CLASSIFIER } from "~/server/email/classify/index.server";
import type { Db } from "~/server/db/client.server";
import { emailMessage, userSettings } from "~/server/db/schema";
import { getMessagesMetadata, listMessageIds } from "~/server/gmail/client.server";
import type { GmailMessage } from "~/server/gmail/mapping.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { USER_ID, testDb } from "./db";

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

  it("records keyword rules as the judge when Jev is over budget (bug 2.1)", async () => {
    const db = connectedGmail();
    await db.insert(userSettings).values({ userId: USER_ID, monthlyBudget: 0 });
    const result = await syncGmail({ DB: {}, TYPESAFE_API_KEY: "key" } as Env, USER_ID, "manual");
    expect(result.error).toBeUndefined();
    expect(await stored(db)).toMatchObject({ subject: "", prunedClassifier: REGEX_CLASSIFIER });
  });
});
