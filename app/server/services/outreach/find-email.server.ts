import type { EmailSource, EmailStatus } from "~/lib/contacts";
import { buildEmail, companyDomain, detectPattern, domainOf, EMAIL_PATTERNS, isCompanyDomain, type EmailPattern, isEmailPattern, nameParts, type NameParts } from "~/lib/email-pattern";
import { senderAddresses } from "~/lib/outreach";
import type { Db } from "../../db/client.server";
import { updateApplication } from "../../db/queries/applications.server";
import { contactsFor, setContactEmail } from "../../db/queries/contacts.server";
import { patternsFor, recordPatterns } from "../../db/queries/email-patterns.server";
import { recordOutreachUsage } from "../../db/queries/outreach-usage.server";
import { generectFindEmail } from "../../outreach/generect.server";
import { checkEmail } from "../../outreach/smtp-check.server";
import { applicationTimeline } from "../timeline/index.server";
import { canSpend } from "./budget.server";

const KNOWN_PATTERNS_TO_TRY = 2;
const GUESSES_TO_TRY = 3;
const UNCHECKABLE = new Set<EmailStatus>(["blocked", "unknown"]);

interface Candidate {
  email: string | null;
  pattern: EmailPattern | null;
  status: EmailStatus;
  source: EmailSource;
}

interface Person {
  leadId: string | null;
  profileUrl: string;
  name: NameParts;
  domain: string;
}

async function firstAccepted(env: Env, patterns: EmailPattern[], toEmail: (pattern: EmailPattern) => string): Promise<Candidate> {
  for (const pattern of patterns) {
    const email = toEmail(pattern);
    const status = (await checkEmail(env, email)) ?? "unknown";
    if (status !== "not_found") return { email, pattern, status, source: UNCHECKABLE.has(status) ? "guess" : "checker" };
  }
  return { email: null, pattern: null, status: "not_found", source: "checker" };
}

async function askGenerect(env: Env, db: Db, userId: string, person: Person): Promise<Candidate | null> {
  if (!env.GENERECT_API_KEY || !(await canSpend(env, db, "generect"))) return null;
  const { match, charges } = await generectFindEmail(env, person);
  if (charges.length) await recordOutreachUsage(db, userId, charges.map((charge) => ({ provider: "generect", action: "find-email", ...charge })));
  if (!match) return null;
  return { ...match, pattern: detectPattern(`${person.name.first} ${person.name.last}`, match.email), source: "generect" };
}

async function whenUncheckable(env: Env, db: Db, userId: string, guess: Candidate, known: EmailPattern[], person: Person): Promise<Candidate> {
  const fromGenerect = await askGenerect(env, db, userId, person);
  if (fromGenerect) return fromGenerect;
  if (known.length) return { email: buildEmail(person.name, known[0], person.domain), pattern: known[0], status: "likely", source: "format" };
  return guess;
}

export async function findContactEmail(env: Env, db: Db, userId: string, applicationId: string, contactId: string) {
  const [{ row, emails }, contacts] = await Promise.all([
    applicationTimeline(db, userId, applicationId),
    contactsFor(db, userId, applicationId),
  ]);
  const person = contacts.find((contact) => contact.id === contactId);
  if (!row || !person) return { error: "That person isn't on this application any more." };

  const domain = companyDomain(row.emailDomain, row.url, senderAddresses(emails));
  if (!domain) return { error: "Add the company's email domain first." };
  const name = nameParts(person.name);
  if (!name) return { error: `Couldn't read a first and last name from "${person.name}".` };
  if (!row.emailDomain) await updateApplication(db, userId, applicationId, { emailDomain: domain });

  const known = (await patternsFor(db, domain)).map((stored) => stored.pattern).filter(isEmailPattern);
  const toEmail = (pattern: EmailPattern) => buildEmail(name, pattern, domain);
  const checked = await firstAccepted(env, known.length ? known.slice(0, KNOWN_PATTERNS_TO_TRY) : EMAIL_PATTERNS.slice(0, GUESSES_TO_TRY), toEmail);
  const found = UNCHECKABLE.has(checked.status)
    ? await whenUncheckable(env, db, userId, checked, known, { leadId: person.leadId, profileUrl: person.profileUrl, name, domain })
    : checked;

  await setContactEmail(db, userId, contactId, found.email, found.status, found.source);
  if (found.email && found.pattern && isCompanyDomain(domainOf(found.email)) && (found.status === "valid" || found.source === "generect")) {
    await recordPatterns(db, [{ domain: domainOf(found.email), pattern: found.pattern }]);
  }
  return { ok: true };
}
