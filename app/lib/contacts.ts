/**
 * A person the listing suggests reaching out to, captured by the extension
 * from LinkedIn's "People you can reach out to" / "Meet the hiring team".
 * Stored as JSON in `application.contacts_json`.
 */
export interface Contact {
  name: string;
  /** https://www.linkedin.com/in/<slug>/ */
  profileUrl: string;
  /** Connection degree: "1st", "2nd", "3rd", "3rd+", or "". */
  degree: string;
  /** Their LinkedIn headline, e.g. "Senior Talent Acquisition @Acme". */
  headline: string;
  /** Why LinkedIn suggests them: "Job poster", "School alum from …". */
  note: string;
}

const MAX_CONTACTS = 10;
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Keeps only linkedin.com/in/ profile links, without query or fragment. */
function profileUrl(value: unknown) {
  try {
    const url = new URL(str(value, 500));
    if (url.protocol !== "https:" || !/(^|\.)linkedin\.com$/.test(url.hostname) || !url.pathname.startsWith("/in/")) return "";
    return `https://www.linkedin.com${url.pathname.replace(/\/?$/, "/")}`;
  } catch {
    return "";
  }
}

/** Validates contacts from the extension (or the database), dropping anything malformed. */
export function cleanContacts(value: unknown): Contact[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const contacts: Contact[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const contact = {
      // Stray leading punctuation (bullets, dashes) is LinkedIn markup, not part of the name.
      name: str(r.name, 120).replace(/^[\s.•·\-_|/]+/, ""),
      profileUrl: profileUrl(r.profileUrl ?? r.profile_url),
      degree: str(r.degree, 10),
      headline: str(r.headline, 240),
      note: str(r.note, 200),
    };
    if (!contact.name || !contact.profileUrl || seen.has(contact.profileUrl)) continue;
    seen.add(contact.profileUrl);
    contacts.push(contact);
    if (contacts.length === MAX_CONTACTS) break;
  }
  return contacts;
}

/** An application's stored contacts; [] for bad or missing JSON. */
export function parseContacts(json: string | null | undefined): Contact[] {
  try {
    return cleanContacts(JSON.parse(json || "[]"));
  } catch {
    return [];
  }
}
