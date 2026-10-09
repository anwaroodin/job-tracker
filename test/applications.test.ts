import { describe, expect, it, vi } from "vitest";
import { getApplication } from "~/server/db/queries/applications.server";
import { applicationSuggestions } from "~/server/services/applications/suggestions.server";
import { trackPosting } from "~/server/services/applications/track.server";
import { setStatusByHand } from "~/server/services/status/manual.server";
import { settleSavedJob } from "~/server/services/status/saved.server";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail } from "./fixtures";

vi.mock("~/server/cache.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  invalidate: vi.fn(),
}));

const posting = (over: Partial<Parameters<typeof trackPosting>[2]> = {}) => ({
  company: "Acme",
  role: "Engineer",
  url: "https://jobs.acme.com/1",
  status: "",
  details: {},
  starred: undefined,
  autoFilled: true,
  ...over,
});

describe("trackPosting", () => {
  it("creates an applied application, not set by hand, when no status is given", async () => {
    const { db } = testDb();
    const { duplicate, application } = await trackPosting(db, USER_ID, posting());
    expect(duplicate).toBe(false);
    expect(application).toMatchObject({ status: "applied", manualStatusAt: null, starred: false, cvType: "software" });
  });

  it("records a picked status as set by hand", async () => {
    const { db } = testDb();
    const { application } = await trackPosting(db, USER_ID, posting({ status: "saved", starred: true }));
    expect(application).toMatchObject({ status: "saved", starred: true });
    expect(application.manualStatusAt).not.toBeNull();
  });

  it("returns the same posting tracked again, filling in details but keeping company and role", async () => {
    const { db } = testDb();
    const first = await trackPosting(db, USER_ID, posting());
    const again = await trackPosting(db, USER_ID, posting({ company: "ACME Inc", details: { location: "London" } }));
    expect(again.duplicate).toBe(true);
    expect(again.application).toMatchObject({ id: first.application.id, company: "Acme", location: "London" });
  });

  it("turns a saved posting into an application and drops its bookmark", async () => {
    const { db } = testDb();
    const saved = await trackPosting(db, USER_ID, posting({ status: "saved", starred: true }));
    const applied = await trackPosting(db, USER_ID, posting({ status: "applied" }));
    expect(applied.application).toMatchObject({ id: saved.application.id, status: "applied", starred: false });
    expect(applied.application?.appliedAt).toBe(applied.application?.manualStatusAt);
  });
});

describe("setStatusByHand", () => {
  it("sets the status by hand so sync won't override it, and refuses saved or unknown statuses", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "a1", status: "applied" });
    expect(await setStatusByHand(db, USER_ID, "a1", "interview")).toMatchObject({ status: "interview" });
    expect((await getApplication(db, USER_ID, "a1"))?.manualStatusAt).toBeTruthy();
    expect(await setStatusByHand(db, USER_ID, "a1", "saved")).toBeNull();
    expect(await setStatusByHand(db, USER_ID, "a1", "hired")).toBeNull();
    expect(await setStatusByHand(db, USER_ID, "missing", "offer")).toBeNull();
  });
});

describe("settleSavedJob", () => {
  it("applies a saved posting today, by hand, without its bookmark", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "s1", status: "saved", starred: true });
    expect(await settleSavedJob(db, USER_ID, "s1", "applied")).toBe(true);
    const row = await getApplication(db, USER_ID, "s1");
    expect(row).toMatchObject({ status: "applied", starred: false });
    expect(row?.appliedAt).toBe(row?.manualStatusAt);
  });

  it("deletes a removed saved posting", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "s1", status: "saved" });
    expect(await settleSavedJob(db, USER_ID, "s1", "removed")).toBe(true);
    expect(await getApplication(db, USER_ID, "s1")).toBeNull();
  });

  it("refuses anything that isn't a saved posting", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "a1", status: "interview" });
    expect(await settleSavedJob(db, USER_ID, "a1", "removed")).toBe(false);
    expect(await getApplication(db, USER_ID, "a1")).not.toBeNull();
  });
});

describe("applicationSuggestions", () => {
  it("groups an untracked email and points it at the latest application at that company", async () => {
    const { db } = testDb();
    await addEmail(db, {
      id: "s1",
      category: "applied",
      isApplication: 0.9,
      suggestedCompany: "Acme",
      suggestedRole: "Engineer",
      receivedAt: new Date().toISOString(),
    });
    const apps = [
      { id: "old", company: "Acme Ltd", role: "Designer", appliedAt: "2026-01-01T00:00:00.000Z" },
      { id: "new", company: "acme", role: "Analyst", appliedAt: "2026-06-01T00:00:00.000Z" },
    ];
    const [suggestion] = await applicationSuggestions(db, USER_ID, Promise.resolve(apps));
    expect(suggestion).toMatchObject({ company: "Acme", role: "Engineer", emailIds: ["s1"], existing: { id: "new" } });
  });
});
