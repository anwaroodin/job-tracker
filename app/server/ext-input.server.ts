/** Validation shared by the browser-extension routes under /api/ext/*. */
import { cleanContacts } from "~/lib/contacts";
import type { NewApplication } from "./db/schema";

const CV_TYPES = new Set(["software", "retail"]);
const CATEGORIES = new Set(["grad", "intern", "junior"]);
/** "saved" is a bookmarked posting that hasn't been applied to yet. */
const STATUSES = new Set([
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
]);

/** A trimmed string of at most `max` characters, or "" for anything else. */
export const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** A known application status, or "" when the value isn't one. */
export function applicationStatus(value: unknown) {
  const status = text(value, 20);
  return STATUSES.has(status) ? status : "";
}

/** The fields of a posting the extension can send, as application columns. */
export type JobDetails = Pick<
  NewApplication,
  | "company"
  | "role"
  | "description"
  | "location"
  | "workType"
  | "salary"
  | "employmentType"
  | "postedAt"
  | "applicants"
  | "contactsJson"
  | "cvType"
  | "category"
>;

/**
 * The job details in an extension request body (snake_case, as the extension
 * sends them), validated. Only non-empty values are returned, so a later save
 * made with less of the page rendered never blanks what an earlier one stored.
 */
export function jobDetails(body: Record<string, unknown>): Partial<JobDetails> {
  const details: Partial<JobDetails> = {};
  const set = <K extends keyof JobDetails>(key: K, value: JobDetails[K]) => {
    if (value) details[key] = value;
  };

  set("company", text(body.company, 200));
  set("role", text(body.role, 200));
  set("description", text(body.description, 20_000));
  set("location", text(body.location, 200));
  set("workType", text(body.work_type, 50));
  set("salary", text(body.salary, 100));
  set("employmentType", text(body.employment_type, 50));
  set("postedAt", pastDate(body.posted_at));
  set("applicants", text(body.applicants, 60));

  const contacts = cleanContacts(body.contacts);
  if (contacts.length) details.contactsJson = JSON.stringify(contacts);

  const cvType = text(body.cv_type, 20);
  if (CV_TYPES.has(cvType)) details.cvType = cvType;
  const category = text(body.category, 20);
  if (CATEGORIES.has(category)) details.category = category;

  return details;
}

/**
 * A date as an ISO string, or "" when it doesn't parse or is in the future
 * (a day of slack covers clock and timezone skew).
 */
function pastDate(value: unknown) {
  const time = new Date(text(value, 40)).getTime();
  return Number.isNaN(time) || time > Date.now() + 86_400_000 ? "" : new Date(time).toISOString();
}

/** Keeps only http(s) URLs and drops the fragment so refills match. */
export function cleanUrl(value: unknown) {
  try {
    const url = new URL(text(value, 2048));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
