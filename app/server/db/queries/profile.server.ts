import { eq } from "drizzle-orm";
import type { Db } from "../client.server";
import { profile } from "../schema";
import type { ProfileForm } from "~/types/profile";
import { EMPTY_CV } from "~/lib/cv";
import { cleanCv } from "../../cv/clean";
import type { Cv } from "~/types/cv";

const nowIso = () => new Date().toISOString();

const EMPTY_PROFILE: ProfileForm = {
  personal: {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      county: "",
      postcode: "",
      country: "",
    },
    linkedin: "",
    github: "",
    portfolio: "",
  },
  eligibility: {
    rightToWork: true,
    requiresSponsorship: false,
    noticePeriod: "",
    availableImmediately: true,
  },
  softwareCV: { summary: "", skills: "", coverLetter: "", salary: "" },
  retailCV: { summary: "", skills: "", coverLetter: "", salary: "" },
};

export async function getProfile(db: Db, userId: string): Promise<ProfileForm> {
  const rows = await db
    .select({
      firstName: profile.firstName,
      lastName: profile.lastName,
      contactEmail: profile.contactEmail,
      phone: profile.phone,
      addressJson: profile.addressJson,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      eligibilityJson: profile.eligibilityJson,
      softwareCvJson: profile.softwareCvJson,
      retailCvJson: profile.retailCvJson,
    })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return EMPTY_PROFILE;

  const parse = <T>(s: string | null, fallback: T): T => {
    if (!s) return fallback;
    try {
      return { ...fallback, ...JSON.parse(s) };
    } catch {
      return fallback;
    }
  };

  return {
    personal: {
      firstName: row.firstName ?? "",
      lastName: row.lastName ?? "",
      email: row.contactEmail ?? "",
      phone: row.phone ?? "",
      address: parse(row.addressJson, EMPTY_PROFILE.personal.address),
      linkedin: row.linkedinUrl ?? "",
      github: row.githubUrl ?? "",
      portfolio: row.portfolioUrl ?? "",
    },
    eligibility: parse(row.eligibilityJson, EMPTY_PROFILE.eligibility),
    softwareCV: parse(row.softwareCvJson, EMPTY_PROFILE.softwareCV),
    retailCV: parse(row.retailCvJson, EMPTY_PROFILE.retailCV),
  };
}

export async function saveProfile(db: Db, userId: string, form: ProfileForm) {
  const row = {
    userId,
    firstName: form.personal.firstName || null,
    lastName: form.personal.lastName || null,
    contactEmail: form.personal.email || null,
    phone: form.personal.phone || null,
    addressJson: JSON.stringify(form.personal.address ?? {}),
    linkedinUrl: form.personal.linkedin || null,
    githubUrl: form.personal.github || null,
    portfolioUrl: form.personal.portfolio || null,
    eligibilityJson: JSON.stringify(form.eligibility ?? {}),
    softwareCvJson: JSON.stringify(form.softwareCV ?? {}),
    retailCvJson: JSON.stringify(form.retailCV ?? {}),
    updatedAt: nowIso(),
  };
  await db
    .insert(profile)
    .values(row)
    .onConflictDoUpdate({ target: profile.userId, set: row });
}

export async function getCv(db: Db, userId: string): Promise<Cv> {
  const [row] = await db
    .select({ json: profile.cvJson })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);
  if (!row?.json) return EMPTY_CV;
  try {
    return cleanCv(JSON.parse(row.json));
  } catch {
    return EMPTY_CV;
  }
}

export function saveCv(db: Db, userId: string, cv: Cv) {
  const now = nowIso();
  const set = { cvJson: JSON.stringify(cv), cvUpdatedAt: now, updatedAt: now };
  return db
    .insert(profile)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: profile.userId, set });
}

export async function getCvTemplate(db: Db, userId: string) {
  const [row] = await db.select({ template: profile.cvTemplate }).from(profile).where(eq(profile.userId, userId)).limit(1);
  return row?.template ?? null;
}

export function saveCvTemplate(db: Db, userId: string, template: string | null) {
  const set = { cvTemplate: template, updatedAt: nowIso() };
  return db
    .insert(profile)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: profile.userId, set });
}
