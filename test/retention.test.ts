import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { REGEX_CLASSIFIER } from "~/server/email/classify/index.server";
import type { Db } from "~/server/db/client.server";
import { emailMessage } from "~/server/db/schema";
import { markJudgedBy, prunedEmailsToFetchAgain, pruneUnrelatedEmails, saveEmail } from "~/server/db/queries/email-retention.server";
import { requestReclassify } from "~/server/db/queries/gmail-sync.server";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail, at, link } from "./fixtures";

const JEV = "jev:1";
const LONG_AGO = Date.UTC(2026, 0, 1);

const prune = (db: Db) => pruneUnrelatedEmails(db, USER_ID, JEV, at(10));
const toFetchAgain = async (db: Db, classifier: string | null = JEV) =>
  (await prunedEmailsToFetchAgain(db, USER_ID, classifier, LONG_AGO)).map((r) => r.id).sort();

async function email(db: Db, id: string) {
  const [row] = await db.select().from(emailMessage).where(eq(emailMessage.id, id));
  return row;
}

async function pruned(db: Db, id: string, over: Partial<typeof emailMessage.$inferInsert> = {}) {
  await addEmail(db, { id, ...over });
  await prune(db);
}

describe("pruning emails that aren't about jobs", () => {
  it("deletes subject, sender and snippet, keeping the Gmail id, thread and date", async () => {
    const { db } = testDb();
    await addEmail(db, { id: "e1", threadId: "t1", receivedAt: at(3) });
    await prune(db);
    expect(await email(db, "e1")).toMatchObject({
      id: "e1",
      threadId: "t1",
      receivedAt: at(3),
      category: "other",
      subject: "",
      snippet: "",
      fromName: "",
      fromAddress: "",
      prunedAt: at(10),
      prunedClassifier: JEV,
    });
  });

  it.each([
    ["a job email", { category: "interview" }],
    ["an email the user labelled", { manualCategoryAt: at(4) }],
  ])("keeps %s", async (_, over) => {
    const { db } = testDb();
    await addEmail(db, { id: "e1", ...over });
    await prune(db);
    expect((await email(db, "e1")).prunedAt).toBeNull();
  });

  it("keeps an email linked to an application", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1" });
    await addEmail(db, { id: "e1" });
    await link(db, "e1", "app-1");
    await prune(db);
    expect((await email(db, "e1")).prunedAt).toBeNull();
  });

  it("keeps thread-mates of a job email", async () => {
    const { db } = testDb();
    await addEmail(db, { id: "e1", threadId: "t1" });
    await addEmail(db, { id: "e2", threadId: "t1", category: "interview" });
    await prune(db);
    expect((await email(db, "e1")).prunedAt).toBeNull();
  });

  it("prunes a thread where nothing is about jobs", async () => {
    const { db } = testDb();
    await addEmail(db, { id: "e1", threadId: "t1" });
    await addEmail(db, { id: "e2", threadId: "t1" });
    await prune(db);
    expect((await email(db, "e1")).prunedAt).toBe(at(10));
    expect((await email(db, "e2")).prunedAt).toBe(at(10));
  });

  it.fails("keeps an unsure 'other' until the user confirms it (decision Q3)", async () => {
    const { db } = testDb();
    await addEmail(db, { id: "e1", confidence: 0.55 });
    await prune(db);
    expect((await email(db, "e1")).prunedAt).toBeNull();
  });
});

describe("fetching removed emails again", () => {
  it("re-fetches a stub once a job email joins its thread", async () => {
    const { db } = testDb();
    await pruned(db, "e1", { threadId: "t1" });
    expect(await toFetchAgain(db)).toEqual([]);
    await addEmail(db, { id: "e2", threadId: "t1", category: "offer" });
    expect(await toFetchAgain(db)).toEqual(["e1"]);
  });

  it("re-fetches stubs judged by a different classifier", async () => {
    const { db } = testDb();
    await pruned(db, "e1");
    expect(await toFetchAgain(db, JEV)).toEqual([]);
    expect(await toFetchAgain(db, REGEX_CLASSIFIER)).toEqual(["e1"]);
  });

  it("only uses the thread rule while the wanted classifier can't run", async () => {
    const { db } = testDb();
    await pruned(db, "e1");
    expect(await toFetchAgain(db, null)).toEqual([]);
  });

  it("re-fetches every stub after a reclassify request", async () => {
    const { db } = testDb();
    await pruned(db, "e1");
    await requestReclassify(db, USER_ID);
    expect(await toFetchAgain(db, JEV)).toEqual(["e1"]);
  });

  it("marks stubs judged by keyword rules after Jev failed, so Jev looks again", async () => {
    const { db } = testDb();
    await pruned(db, "e1");
    await markJudgedBy(db, USER_ID, ["e1"], REGEX_CLASSIFIER);
    expect((await email(db, "e1")).prunedClassifier).toBe(REGEX_CLASSIFIER);
    expect(await toFetchAgain(db, JEV)).toEqual(["e1"]);
  });
});

describe("saving a downloaded email", () => {
  const row = (over: Partial<typeof emailMessage.$inferInsert> = {}) => ({
    userId: USER_ID,
    id: "e1",
    threadId: "t1",
    category: "interview",
    confidence: 0.9,
    subject: "Interview",
    snippet: "Let's talk",
    fromName: "Acme",
    fromAddress: "jobs@acme.com",
    receivedAt: at(3),
    ...over,
  });

  it("restores a stub's content and clears the pruned marker", async () => {
    const { db } = testDb();
    await pruned(db, "e1", { threadId: "t1", receivedAt: at(3) });
    await saveEmail(db, row());
    expect(await email(db, "e1")).toMatchObject({ subject: "Interview", category: "interview", prunedAt: null, prunedClassifier: null });
  });

  it("never overwrites an email that wasn't pruned", async () => {
    const { db } = testDb();
    await addEmail(db, { id: "e1", category: "offer", manualCategoryAt: at(4) });
    await saveEmail(db, row());
    expect(await email(db, "e1")).toMatchObject({ category: "offer", subject: "Subject e1" });
  });

  it("keeps a stub's date when Gmail reports it deleted (bug 2.3)", async () => {
    const { db } = testDb();
    await pruned(db, "e1", { receivedAt: at(3) });
    await saveEmail(db, { userId: USER_ID, id: "e1", category: "deleted", receivedAt: "" });
    expect((await email(db, "e1")).receivedAt).toBe(at(3));
  });
});
