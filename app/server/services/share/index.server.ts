import type { Db } from "~/server/db/client.server";
import { getApplication } from "~/server/db/queries/applications.server";
import { getCvTemplate, getProfile } from "~/server/db/queries/profile.server";
import { liveShareLink, putShareLink } from "~/server/db/queries/share-links.server";
import { latestTailoredCv } from "~/server/db/queries/tailored-cv.server";
import { personFor, typstCv } from "~/lib/cv";
import { DEFAULT_SHARE_DAYS, SHARE_DAYS } from "~/lib/share";
import { DEFAULT_CV_TEMPLATE } from "~/lib/typst";

export const PRIVATE_HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const shareDays = (value: unknown) => SHARE_DAYS.find((d) => String(d) === value) ?? DEFAULT_SHARE_DAYS;
export const expiryIn = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Replaces any earlier link for the application, so the old URL stops working. Only the hash is stored. */
export async function createShareLink(db: Db, userId: string, applicationId: string, days: number, includeCv: boolean) {
  const token = newToken();
  await putShareLink(db, { userId, applicationId, tokenHash: await sha256(token), includeCv, expiresAt: expiryIn(days) });
  return token;
}

export async function sharedApplication(db: Db, token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const link = await liveShareLink(db, await sha256(token), new Date().toISOString());
  if (!link) return null;
  const [row, tailored, profile, template] = await Promise.all([
    getApplication(db, link.userId, link.applicationId),
    link.includeCv ? latestTailoredCv(db, link.userId, link.applicationId) : null,
    link.includeCv ? getProfile(db, link.userId) : null,
    link.includeCv ? getCvTemplate(db, link.userId) : null,
  ]);
  if (!row) return null;
  const { company, role, location, workType, url, description } = row;
  return {
    job: { company, role, location, workType, url, description },
    expiresAt: link.expiresAt,
    cv: tailored && profile ? { template: template ?? DEFAULT_CV_TEMPLATE, typst: typstCv(personFor(profile.personal, link.account), tailored.cv) } : null,
  };
}
