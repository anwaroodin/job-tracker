import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { application } from "~/server/db/schema";
import type { emailMessage } from "~/server/db/schema";
import { planLinksAndStatuses } from "~/server/gmail/sync/plan.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { shouldFollowEmail } from "~/server/services/status/rules";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail, at, link, setMinConfidence } from "./fixtures";

vi.mock("~/server/cache.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  invalidate: vi.fn(),
}));

type StoredEmail = typeof emailMessage.$inferSelect;

const app = (over: Partial<Parameters<typeof shouldFollowEmail>[0]> = {}) => ({
  id: "app-1",
  company: "Acme",
  role: "Engineer",
  appliedAt: at(1),
  status: "applied",
  manualStatusAt: null,
  ...over,
});

const stored = (id: string, over: Partial<StoredEmail> = {}): StoredEmail => ({
  userId: USER_ID,
  id,
  threadId: id,
  category: "interview",
  confidence: null,
  manualCategoryAt: null,
  manualKind: null,
  detailsAt: null,
  eventAt: null,
  eventText: null,
  actionUrl: null,
  actionText: null,
  needsReply: null,
  replyDoneAt: null,
  suggestionAt: null,
  isApplication: null,
  suggestedCompany: null,
  suggestedRole: null,
  suggestionConfidence: null,
  suggestionDismissedAt: null,
  subject: "Interview at Acme",
  snippet: "",
  fromName: "Acme Recruiting",
  fromAddress: "jobs@acme.com",
  receivedAt: at(3),
  prunedAt: null,
  prunedClassifier: null,
  ...over,
});

describe("shouldFollowEmail", () => {
  const latest = { applicationId: "app-1", category: "interview", receivedAt: at(3) };

  it("follows a newer stage email", () => {
    expect(shouldFollowEmail(app(), latest)).toBe(true);
  });

  it("ignores an email that matches the current status", () => {
    expect(shouldFollowEmail(app({ status: "interview" }), latest)).toBe(false);
  });

  it.each(["accepted", "withdrawn"])("never moves a %s application", (status) => {
    expect(shouldFollowEmail(app({ status }), latest)).toBe(false);
  });

  it("respects a status set by hand after the email", () => {
    expect(shouldFollowEmail(app({ status: "offer", manualStatusAt: at(4) }), latest)).toBe(false);
  });

  it("follows an email that arrived after the status was set by hand", () => {
    expect(shouldFollowEmail(app({ status: "offer", manualStatusAt: at(2) }), latest)).toBe(true);
  });
});

describe("planLinksAndStatuses", () => {
  it("links a matching email and follows its stage", () => {
    const plan = planLinksAndStatuses([stored("e1")], [app()], [], 0.8);
    expect(plan.links).toEqual([{ emailId: "e1", applicationId: "app-1", category: "interview", receivedAt: at(3) }]);
    expect(plan.statusChanges).toEqual([{ applicationId: "app-1", status: "interview", from: "applied" }]);
  });

  it("links an unsure email but doesn't change the status", () => {
    const plan = planLinksAndStatuses([stored("e1", { confidence: 0.5 })], [app()], [], 0.8);
    expect(plan.links).toHaveLength(1);
    expect(plan.statusChanges).toEqual([]);
  });

  it("lets a confirmed unsure email change the status", () => {
    const plan = planLinksAndStatuses([stored("e1", { confidence: 0.5, manualCategoryAt: at(4) })], [app()], [], 0.8);
    expect(plan.statusChanges).toHaveLength(1);
  });

  it.each(["applied", "other"])("never sets a status from a %s email", (category) => {
    const plan = planLinksAndStatuses([stored("e1", { category })], [app({ status: "interview" })], [], 0.8);
    expect(plan.statusChanges).toEqual([]);
  });

  it("keeps the newest stage when an older email arrives late", () => {
    const latest = [{ applicationId: "app-1", category: "offer", receivedAt: at(5) }];
    const plan = planLinksAndStatuses([stored("e1", { receivedAt: at(3) })], [app({ status: "offer" })], latest, 0.8);
    expect(plan.statusChanges).toEqual([]);
  });

  it("doesn't link an applied confirmation to an application rejected before it", () => {
    const latest = [{ applicationId: "app-1", category: "rejected", receivedAt: at(2) }];
    const plan = planLinksAndStatuses([stored("e1", { category: "applied" })], [app({ status: "rejected" })], latest, 0.8);
    expect(plan.links).toEqual([]);
  });
});

describe("refreshApplicationStatus", () => {
  async function statusOf(db: ReturnType<typeof testDb>["db"], id: string) {
    const [row] = await db.select({ status: application.status }).from(application).where(eq(application.id, id));
    return row.status;
  }

  it("moves an application to its latest confident stage email", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1" });
    await addEmail(db, { id: "e1", category: "screening", receivedAt: at(2) });
    await addEmail(db, { id: "e2", category: "interview", confidence: 0.9, receivedAt: at(3) });
    await link(db, "e1", "app-1");
    await link(db, "e2", "app-1");
    const changes = await refreshApplicationStatus(db, USER_ID, "app-1");
    expect(changes).toEqual([{ applicationId: "app-1", from: "applied", to: "interview" }]);
    expect(await statusOf(db, "app-1")).toBe("interview");
  });

  it("ignores unsure stage emails when choosing the stage", async () => {
    const { db } = testDb();
    await setMinConfidence(db, 0.8);
    await addApplication(db, { id: "app-1", status: "screening" });
    await addEmail(db, { id: "e1", category: "screening", receivedAt: at(2) });
    await addEmail(db, { id: "e2", category: "offer", confidence: 0.5, receivedAt: at(3) });
    await link(db, "e1", "app-1");
    await link(db, "e2", "app-1");
    expect(await refreshApplicationStatus(db, USER_ID, "app-1")).toEqual([]);
  });

  it("reverts to applied when the only stage email is unlinked", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", status: "interview" });
    await addEmail(db, { id: "e1", category: "interview" });
    await link(db, "e1", "app-1", at(4));
    await refreshApplicationStatus(db, USER_ID, "app-1");
    expect(await statusOf(db, "app-1")).toBe("applied");
  });

  it("keeps a status set by hand after the last email", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", status: "offer", manualStatusAt: at(5) });
    await addEmail(db, { id: "e1", category: "interview", receivedAt: at(3) });
    await link(db, "e1", "app-1");
    expect(await refreshApplicationStatus(db, USER_ID, "app-1")).toEqual([]);
  });

  it("leaves accepted applications alone", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app-1", status: "accepted" });
    await addEmail(db, { id: "e1", category: "rejected" });
    await link(db, "e1", "app-1");
    expect(await refreshApplicationStatus(db, USER_ID, "app-1")).toEqual([]);
  });

  it("an unsure email newer than a status set by hand doesn't override it (bug 2.2)", async () => {
    const { db } = testDb();
    await setMinConfidence(db, 0.8);
    await addApplication(db, { id: "app-1", status: "offer", manualStatusAt: at(2) });
    await addEmail(db, { id: "e1", category: "rejected", confidence: 0.55, receivedAt: at(3) });
    await link(db, "e1", "app-1");
    await refreshApplicationStatus(db, USER_ID, "app-1");
    expect(await statusOf(db, "app-1")).toBe("offer");
  });
});
