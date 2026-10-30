import { describe, expect, it } from "vitest";
import { followUps } from "~/server/services/follow-up/index.server";
import { followUpRecipient, quietDays } from "~/server/services/follow-up/rules";
import { USER_ID, testDb } from "./db";
import { addApplication, addEmail, at, link } from "./fixtures";

const day = (n: number) => new Date(Date.parse(at(1)) + n * 86_400_000);

describe("follow-up nudges", () => {
  it("nudges an active application quiet for 14 to 60 days since its last activity", () => {
    const app = { status: "applied", appliedAt: at(1), followedUpAt: null };
    expect(quietDays(app, null, day(13))).toBeNull();
    expect(quietDays(app, null, day(14))).toBe(14);
    expect(quietDays(app, null, day(61))).toBeNull();
    expect(quietDays({ ...app, status: "rejected" }, null, day(20))).toBeNull();
    expect(quietDays(app, at(10), day(20))).toBeNull();
    expect(quietDays({ ...app, followedUpAt: at(10) }, null, day(20))).toBeNull();
  });

  it("writes to the latest person, never an automated sender", () => {
    const emails = [
      { fromAddress: "jo@acme.com", receivedAt: at(2) },
      { fromAddress: "no-reply@greenhouse.io", receivedAt: at(5) },
    ];
    expect(followUpRecipient(emails)).toBe("jo@acme.com");
    expect(followUpRecipient(emails.slice(1))).toBe("");
  });

  it("lists quiet applications from the database, counting linked emails as activity", async () => {
    const { db } = testDb();
    await addApplication(db, { id: "quiet", appliedAt: at(1) });
    await addApplication(db, { id: "replied", appliedAt: at(1) });
    await addApplication(db, { id: "closed", appliedAt: at(1), status: "rejected" });
    await addEmail(db, { id: "e1", receivedAt: at(15) });
    await link(db, "e1", "replied");
    const ids = (await followUps(db, USER_ID, day(20))).map((f) => f.applicationId);
    expect(ids).toEqual(["quiet"]);
  });
});
