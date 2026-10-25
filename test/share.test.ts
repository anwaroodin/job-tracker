import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { activeShareLinks, deleteShareLink, shareLinkFor, updateShareLink } from "~/server/db/queries/share-links.server";
import { insertTailoredCv } from "~/server/db/queries/tailored-cv.server";
import { createShareLink, sharedApplication } from "~/server/services/share/index.server";
import { shareLink } from "~/server/db/schema";
import type { TailoredCv } from "~/types/cv";
import { USER_ID, testDb } from "./db";
import { addApplication } from "./fixtures";

async function seed() {
  const { db } = testDb();
  await addApplication(db, { id: "app", description: "Build things", notes: "private note", salary: "my ask" });
  return db;
}

describe("share links", () => {
  it("shares the job without private fields and stores only a hash of the token", async () => {
    const db = await seed();
    const token = await createShareLink(db, USER_ID, "app", 7, true);
    const shared = await sharedApplication(db, token);
    expect(shared?.job).toEqual({ company: "Acme", role: "Engineer", location: "", workType: "", url: "", description: "Build things" });
    expect(shared?.cv).toBeNull();
    expect(JSON.stringify(shared)).not.toMatch(/private note|my ask/);
    const [row] = await db.select().from(shareLink);
    expect(row.tokenHash).not.toContain(token);
    expect(await sharedApplication(db, row.tokenHash)).toBeNull();
  });

  it("rejects wrong, expired, replaced and revoked tokens", async () => {
    const db = await seed();
    const old = await createShareLink(db, USER_ID, "app", 1, false);
    expect(await sharedApplication(db, old.slice(0, -1) + (old.endsWith("A") ? "B" : "A"))).toBeNull();
    const current = await createShareLink(db, USER_ID, "app", 1, false);
    expect(await sharedApplication(db, old)).toBeNull();
    expect(await sharedApplication(db, current)).not.toBeNull();
    await updateShareLink(db, USER_ID, "app", new Date().toISOString(), { expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(await sharedApplication(db, current)).toBeNull();
    expect(await shareLinkFor(db, USER_ID, "app", new Date().toISOString())).toBeNull();
    await updateShareLink(db, USER_ID, "app", new Date().toISOString(), { expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(await sharedApplication(db, current)).toBeNull();
    const renewed = await createShareLink(db, USER_ID, "app", 1, false);
    expect(await sharedApplication(db, renewed)).not.toBeNull();
    await deleteShareLink(db, USER_ID, "app");
    expect(await sharedApplication(db, renewed)).toBeNull();
    expect(await shareLinkFor(db, USER_ID, "app", new Date().toISOString())).toBeNull();
  });

  it("includes the latest tailored CV only when asked", async () => {
    const db = await seed();
    const cv = { summary: "Hi", experience: [], education: [], projects: [], skills: [], certifications: [], changes: [], flags: [], coverLetter: { paragraphs: [] } } as unknown as TailoredCv;
    await insertTailoredCv(db, USER_ID, "app", 1, cv);
    const token = await createShareLink(db, USER_ID, "app", 7, true);
    expect((await sharedApplication(db, token))?.cv?.typst.summary).toBe("Hi");
    await updateShareLink(db, USER_ID, "app", new Date().toISOString(), { includeCv: false });
    expect((await sharedApplication(db, token))?.cv).toBeNull();
  });

  it("lists only live links for the settings page", async () => {
    const db = await seed();
    await addApplication(db, { id: "old", company: "Old Co" });
    await createShareLink(db, USER_ID, "app", 7, false);
    await createShareLink(db, USER_ID, "old", 1, false);
    await db.update(shareLink).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(shareLink.applicationId, "old"));
    expect((await activeShareLinks(db, USER_ID, new Date().toISOString())).map((l) => l.company)).toEqual(["Acme"]);
  });
});
