import { eq } from "drizzle-orm";
import type { Db } from "./client.server";
import { profile } from "./schema";

const nowIso = () => new Date().toISOString();

export interface ProfileForm {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: {
      line1: string;
      line2: string;
      city: string;
      county: string;
      postcode: string;
      country: string;
    };
    linkedin: string;
    github: string;
    portfolio: string;
  };
  eligibility: {
    rightToWork: boolean;
    requiresSponsorship: boolean;
    noticePeriod: string;
    availableImmediately: boolean;
  };
  softwareCV: {
    summary: string;
    skills: string;
    coverLetter: string;
    salary: string;
  };
  retailCV: {
    summary: string;
    skills: string;
    coverLetter: string;
    salary: string;
  };
}

export const EMPTY_PROFILE: ProfileForm = {
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
    .select()
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
