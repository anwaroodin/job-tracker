export interface NameParts {
  first: string;
  last: string;
}

const BUILD = {
  "first.last": ({ first, last }: NameParts) => `${first}.${last}`,
  first: ({ first }: NameParts) => first,
  flast: ({ first, last }: NameParts) => `${first[0]}${last}`,
  firstlast: ({ first, last }: NameParts) => `${first}${last}`,
  "f.last": ({ first, last }: NameParts) => `${first[0]}.${last}`,
  first_last: ({ first, last }: NameParts) => `${first}_${last}`,
  "first-last": ({ first, last }: NameParts) => `${first}-${last}`,
  firstl: ({ first, last }: NameParts) => `${first}${last[0]}`,
  "last.first": ({ first, last }: NameParts) => `${last}.${first}`,
  lastf: ({ first, last }: NameParts) => `${last}${first[0]}`,
  last: ({ last }: NameParts) => last,
} satisfies Record<string, (name: NameParts) => string>;

export type EmailPattern = keyof typeof BUILD;

export const EMAIL_PATTERNS = Object.keys(BUILD) as EmailPattern[];

export const isEmailPattern = (value: unknown): value is EmailPattern =>
  typeof value === "string" && Object.hasOwn(BUILD, value);

export const JOB_BOARD_DOMAINS =
  /(^|\.)(myworkday(jobs)?|greenhouse(-mail)?|lever|workable(mail)?|ashbyhq|smartrecruiters|icims|successfactors|taleo|jobvite|teamtailor|recruitee|bamboohr|pinpointhq|indeed|linkedin|cv-library|reed|totaljobs|glassdoor|hirevue|oraclecloud|beapplied|applytojob|gmail|outlook|hotmail)\./i;

export const AUTOMATED_SENDER = /no-?reply|do-?not-?reply|notifications?@|mailer-daemon|alerts?@/i;

const ROLE_MAILBOX = /^(careers?|jobs?|recruit\w*|talent\w*|hr|hiring|people|team|hello|hi|info|contact|support|admin|no-?reply|notifications?)$/;

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "mx", "prof", "sir", "jr", "sr", "ii", "iii", "iv"]);

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com",
]);

export const domainOf = (address: string) => address.split("@")[1]?.trim().toLowerCase() ?? "";

const DOMAIN = /^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);

export const isCompanyDomain = (domain: string) =>
  DOMAIN.test(domain) && !PERSONAL_DOMAINS.has(domain) && !JOB_BOARD_DOMAINS.test(`${domain}.`);

export function cleanDomain(value: unknown) {
  const domain = String(value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.|.*@)/, "").split(/[/?#]/)[0];
  return DOMAIN.test(domain) ? domain : "";
}

function registrableDomain(host: string) {
  const labels = host.replace(/^www\./, "").split(".");
  const keep = labels.length > 2 && labels.at(-1)!.length === 2 && SECOND_LEVEL.has(labels.at(-2)!) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export function companyDomain(saved: string, jobUrl: string, senderAddresses: string[]) {
  if (saved) return saved;
  const fromEmails = mostCommon(senderAddresses.map(domainOf).filter(isCompanyDomain));
  if (fromEmails) return fromEmails;
  const host = URL.canParse(jobUrl) ? new URL(jobUrl).hostname.toLowerCase() : "";
  return host && isCompanyDomain(host) ? registrableDomain(host) : "";
}

function toWords(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word && !HONORIFICS.has(word));
}

export function nameParts(fullName: string): NameParts | null {
  const [beforeComma, afterComma = ""] = fullName.split(",", 2);
  const lastFirst = toWords(beforeComma).length === 1 && toWords(afterComma).length > 0;
  const words = lastFirst ? [...toWords(afterComma), ...toWords(beforeComma)] : toWords(beforeComma);
  if (words.length < 2) return null;
  return { first: words[0].replace(/-/g, ""), last: words.at(-1)!.replace(/-/g, "") };
}

export const buildEmail = (name: NameParts, pattern: EmailPattern, domain: string) => `${BUILD[pattern](name)}@${domain}`;

export function detectPattern(fullName: string, address: string): EmailPattern | null {
  const name = nameParts(fullName);
  const local = address.split("@")[0]?.toLowerCase();
  if (!name || !local || ROLE_MAILBOX.test(local)) return null;
  return EMAIL_PATTERNS.find((pattern) => BUILD[pattern](name) === local) ?? null;
}
