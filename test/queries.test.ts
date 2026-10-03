import { describe, expect, it } from "vitest";
import { findRecentDuplicate } from "~/server/db/queries/applications.server";
import { reclassifyEstimate, usageDashboard } from "~/server/db/queries/usage.server";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail, at, link, setMinConfidence } from "./fixtures";
import { asBatch } from "~/server/db/batch.server";
import { activityInserts, recentActivity, unseenActivityCount } from "~/server/db/queries/activity.server";
import { matchesDismissed } from "~/server/email/suggestions.server";

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

describe("suggestion activity", () => {
  it("drops suggestions once dismissed or tracked, from the feed and the unseen count", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app" });
    await addEmail(db, { id: "open", category: "applied" });
    await addEmail(db, { id: "dismissed", category: "applied", suggestionDismissedAt: at(3) });
    await addEmail(db, { id: "tracked", category: "applied" });
    await link(db, "tracked", "app");
    const items = ["open", "dismissed", "tracked"].map((emailId) => ({ kind: "suggestion" as const, emailId }));
    await db.batch(asBatch([...activityInserts(db, USER_ID, items, at(4)), ...activityInserts(db, USER_ID, [{ kind: "email", applicationId: "app", emailId: "tracked" }], at(4))]));

    const feed = await recentActivity(db, USER_ID);
    expect(feed.map((item) => item.kind).sort()).toEqual(["email", "suggestion"]);
    expect((await unseenActivityCount(db, USER_ID))[0].count).toBe(2);
  });

  it("drops email notifications whose link was removed or points elsewhere", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "app" });
    await addApplication(db, { id: "other" });
    await addEmail(db, { id: "linked", category: "interview" });
    await addEmail(db, { id: "removed", category: "interview" });
    await link(db, "linked", "app");
    await link(db, "removed", "app", at(5));
    await db.batch(
      asBatch(
        activityInserts(db, USER_ID, [
          { kind: "email", applicationId: "app", emailId: "linked" },
          { kind: "email", applicationId: "other", emailId: "linked" },
          { kind: "reply", applicationId: "app", emailId: "removed" },
          { kind: "status", applicationId: "app", detail: { to: "interview" } },
        ], at(6)),
      ),
    );
    const feed = await recentActivity(db, USER_ID);
    expect(feed.map((item) => `${item.kind}:${item.applicationId}`).sort()).toEqual(["email:app", "status:app"]);
  });

  it("matches later emails to a dismissed suggestion by thread or company", () => {
    const wasDismissed = matchesDismissed([{ threadId: "t1", company: "Acme Ltd", role: "Engineer" }]);
    expect(wasDismissed({ threadId: "t1", company: null, role: null })).toBe(true);
    expect(wasDismissed({ threadId: "t2", company: "ACME", role: null })).toBe(true);
    expect(wasDismissed({ threadId: "t2", company: "Acme", role: "engineer" })).toBe(true);
    expect(wasDismissed({ threadId: "t2", company: "Acme", role: "Designer" })).toBe(false);
    expect(wasDismissed({ threadId: "t2", company: "Globex", role: null })).toBe(false);
  });
});
