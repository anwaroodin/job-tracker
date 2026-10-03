import { describe, expect, it } from "vitest";
import { findRecentDuplicate } from "~/server/db/queries/applications.server";
import { reclassifyEstimate, usageDashboard } from "~/server/db/queries/usage.server";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail, at, setMinConfidence } from "./fixtures";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe("findRecentDuplicate", () => {
  it("prefers a URL match, falls back to company and role, and ignores old applications", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "by-url", url: "https://jobs/1", company: "Other", role: "Other", appliedAt: daysAgo(10) });
    await addApplication(db, { id: "by-role", company: "Acme", role: "Engineer", appliedAt: daysAgo(2) });
    await addApplication(db, { id: "too-old", url: "https://jobs/2", appliedAt: daysAgo(60) });
    const match = { url: "https://jobs/1", company: "ACME", role: "engineer" };
    expect((await findRecentDuplicate(db, USER_ID, match))?.id).toBe("by-url");
    expect((await findRecentDuplicate(db, USER_ID, { ...match, url: "" }))?.id).toBe("by-role");
    expect(await findRecentDuplicate(db, USER_ID, { url: "https://jobs/2", company: "", role: "" })).toBeNull();
    expect((await findRecentDuplicate(db, USER_ID, { url: "https://jobs/2", company: "", role: "" }, 365))?.id).toBe("too-old");
  });
});

describe("email counts on Settings and Usage", () => {
  async function seed() {
    const { db } = testDb();
    await setMinConfidence(db, 0.8);
    await addEmail(db, { id: "kept", category: "interview", confidence: 0.9 });
    await addEmail(db, { id: "unsure", category: "interview", confidence: 0.5 });
    await addEmail(db, { id: "labelled", category: "offer", manualCategoryAt: at(4), manualKind: "corrected" });
    await addEmail(db, { id: "stub", prunedAt: at(5) });
    await addEmail(db, { id: "gone", category: "deleted" });
    return db;
  }

  it("estimates a reclassify over stored emails only", async () => {
    expect((await reclassifyEstimate(await seed(), USER_ID)).emails).toBe(2);
  });

  it("counts stored emails without stubs and judges unsure by the user's threshold", async () => {
    const usage = await usageDashboard(await seed(), USER_ID);
    expect(usage.emails).toMatchObject({ stored: 2, byJev: 2, unsure: 1, corrected: 1 });
    expect(usage.settings.minConfidence).toBe(0.8);
  });
});
