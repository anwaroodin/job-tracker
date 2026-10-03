import { describe, expect, it } from "vitest";
import { upNext } from "~/server/services/overview/up-next.server";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail, link } from "./fixtures";

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe("upNext", () => {
  it("lists replies and upcoming events for open applications only", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "open", company: "Open Co" });
    await addApplication(db, { id: "closed", company: "Closed Co", status: "rejected" });
    await addEmail(db, { id: "reply", category: "interview", needsReply: 0.9, receivedAt: daysFromNow(-2) });
    await addEmail(db, { id: "event", category: "interview", eventAt: daysFromNow(3).slice(0, 10), receivedAt: daysFromNow(-1) });
    await addEmail(db, { id: "past", category: "interview", eventAt: daysFromNow(-3).slice(0, 10), receivedAt: daysFromNow(-5) });
    await addEmail(db, { id: "closed-event", category: "interview", eventAt: daysFromNow(2).slice(0, 10) });
    await addEmail(db, { id: "dismissed", category: "interview", needsReply: 0.9, receivedAt: daysFromNow(-1) });
    await addEmail(db, { id: "plain", category: "applied" });
    await link(db, "reply", "open");
    await link(db, "event", "open");
    await link(db, "past", "open");
    await link(db, "closed-event", "closed");
    await link(db, "dismissed", "open", daysFromNow(0));
    await link(db, "plain", "open");

    const next = await upNext(db, USER_ID);
    expect(next.replies.map((r) => r.emailId)).toEqual(["reply"]);
    expect(next.upcoming.map((r) => r.emailId)).toEqual(["event"]);
    expect(next.upcoming[0]).toMatchObject({ applicationId: "open", company: "Open Co" });
  });
});
