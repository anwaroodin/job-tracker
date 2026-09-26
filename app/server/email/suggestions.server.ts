const MAX_CANDIDATES = 12;
const MAX_ROLE_WORDS = 8;

export const SUGGESTION_LOOKBACK_MS = 60 * 86_400_000;
export const MIN_APPLICATION_PROBABILITY = 0.5;

const NAME = String.raw`[A-Z0-9][\w&.'’+-]*(?:[ \t]+(?:of|and|&|[A-Z0-9][\w&.'’+-]*)){0,4}`;
const ROLE_END = String.raw`(?=\s*(?:[.!,;(|·•]|\s[–—-]\s|$|\s(?:at|with|in)\s[A-Z]))`;

const JOB_BOARD_DOMAINS =
  /(^|\.)(myworkday(jobs)?|greenhouse(-mail)?|lever|workable(mail)?|ashbyhq|smartrecruiters|icims|successfactors|taleo|jobvite|teamtailor|recruitee|bamboohr|pinpointhq|indeed|linkedin|cv-library|reed|totaljobs|glassdoor|hirevue|oraclecloud|beapplied|applytojob|gmail|outlook|hotmail)\./i;
const JOB_BOARD_WORDS =
  /\b(linked ?in|indeed|cv-?library|glassdoor|reed\.co|totaljobs|workday|greenhouse|lever\.co|ashby|smartrecruiters|workable|hirevue|monster|jobsite|otta|welcome to the jungle)\b/i;
const SENDER_NOISE =
  /\b(do[_ ]?not[_ ]?reply|no[_-]?reply|noreply|notifications?|notify|hr|workday|talent|acquisition|team|careers?|recruit(?:ing|ment|er)?|jobs?|hiring|apply|people|admin|mail)\b/gi;
const NOT_A_NAME =
  /^(the|a|an|we|our|your|you|this|that|hi|hello|dear|thank|thanks|application|applications|position|role|job|team|us|it|all|any|interest|review|information|request|confirmation|received|re|fw|fwd)$/i;
const SENTENCE_WORDS =
  /\b(application|confirmation|received|review|request|thank|update|next steps?|we|you|your|our|has|have|been|will|was|is|please|this|that|shortly|soon)\b/i;

const JOB_LINK = /linkedin\.com\/(?:comm\/)?jobs\/view|\/(?:jobs?|careers?|vacanc(?:y|ies)|positions?|postings?|opportunit(?:y|ies))\//i;
const LINKEDIN_JOB_LINK = /linkedin\.com\/(?:comm\/)?jobs\/view/i;
const GENERIC_LINK_TEXT = /^(view|see|apply|open|click|learn|more|here|search|find|explore|browse|similar|recommended)\b/i;

const NOT_A_ROLE = /\b(invitation|invite|interview|assessment|offer|confirmation|reminder|update|regarding|re|fwd?)\b/i;
const ROLE_FILLER = /^(?:the\s+)?(?:above|below|following|same|said|mentioned|aforementioned|relevant|advertised|open|new)(?:\s+(?:role|position|job|vacancy))?$/i;
const SUBJECT_PARTS = /\s[|–—&-]\s?|\s?[|–—&-]\s|:|\|/;
const TIME_OR_NUMBER = /^\d+(?:[:.]\d+)?\s*(?:am|pm)?$/i;
const REPLY_PREFIX = /^\s*(?:(?:re|fwd?|aw|sv)\s*:\s*)+/i;

const KNOWN_FORMATS: { pattern: RegExp; company?: number; role?: number; trusted?: false }[] = [
  { pattern: new RegExp(String.raw`application was sent to (${NAME})`, "i"), company: 1 },
  { pattern: new RegExp(String.raw`your application to (.{3,80}?) at (${NAME})`, "i"), role: 1, company: 2 },
  {
    pattern: new RegExp(String.raw`you applied (?:for|to) (?:the )?(.{3,80}?) (?:role |position |job )?at (${NAME})`, "i"),
    role: 1,
    company: 2,
  },
  { pattern: new RegExp(String.raw`application (?:has been )?submitted to (${NAME})`, "i"), company: 1 },
  { pattern: /Indeed Application:\s*(.{3,80}?)\s+[–—-]\s+(.{2,60})$/im, role: 1, company: 2, trusted: false },
  { pattern: /Indeed Application:\s*(.{3,80}?)\s*$/im, role: 1, trusted: false },
];

export interface SuggestionSource {
  subject: string;
  fromName: string;
  fromAddress: string;
  text: string;
  links?: { url: string; text: string }[];
}

export interface SuggestionCandidates {
  companies: string[];
  roles: string[];
  knownCompany: string | null;
  knownRole: string | null;
}

export function suggestionCandidates(original: SuggestionSource): SuggestionCandidates {
  const source = { ...original, subject: original.subject.replace(REPLY_PREFIX, "") };
  const trusted = knownFormat(source, true);
  const hinted = knownFormat(source, false);
  const companies = companyCandidates(source, [trusted.company, hinted.company]);
  const roles = roleCandidates(source, [trusted.role, hinted.role]);
  return {
    companies,
    roles,
    knownCompany: trusted.company && companies.includes(trusted.company) ? trusted.company : null,
    knownRole: trusted.role && roles.includes(trusted.role) ? trusted.role : null,
  };
}

export function normalizeCompany(company: string) {
  return company
    .toLowerCase()
    .replace(/\b(ltd|limited|inc|llc|plc|group|uk|the|technologies|technology)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function knownFormat({ subject, text, links = [] }: SuggestionSource, wantTrusted: boolean) {
  let company: string | null = null;
  let role: string | null = null;
  for (const { pattern, company: companyGroup, role: roleGroup, trusted = true } of KNOWN_FORMATS) {
    if (trusted !== wantTrusted) continue;
    const match = pattern.exec(subject) ?? pattern.exec(text);
    if (!match) continue;
    if (companyGroup && !company) company = cleanCompany(match[companyGroup]);
    if (roleGroup && !role) role = cleanRole(match[roleGroup]);
  }
  if (wantTrusted && company && !role) {
    role = jobLinkTexts(links, LINKEDIN_JOB_LINK)[0] ?? roleBetweenCompanyMentions(text, company);
  }
  return { company: isCompany(company) ? company : null, role: isRole(role) ? role : null };
}

function roleBetweenCompanyMentions(text: string, company: string) {
  const name = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(String.raw`(?:${name}\s+)+(.{3,80}?)\s+${name}\s*[·•|]`).exec(text);
  return match ? cleanRole(match[1]) : null;
}

function companyCandidates({ subject, fromName, fromAddress, text }: SuggestionSource, known: (string | null)[]) {
  const found = known.filter((value): value is string => !!value);
  const haystack = `${subject}\n${text}`;
  const patterns = [
    new RegExp(String.raw`\b(?:applying|applied|application|apply|applications?)\s+(?:to|at|with)\s+(?:the\s+)?(${NAME})`, "g"),
    new RegExp(String.raw`\binterest in\s+(?:joining\s+)?(${NAME})(?=\s*(?:[.!,]|and\b))`, "g"),
    new RegExp(String.raw`\s(?:at|with|join)\s+(${NAME})`, "g"),
    new RegExp(String.raw`[–—-]\s+(${NAME})\s*$`, "gm"),
  ];
  for (const pattern of patterns) for (const [, name] of haystack.matchAll(pattern)) found.push(name);
  found.push(...subject.split(SUBJECT_PARTS).filter((part) => part.trim().split(/\s+/).length <= 4));
  found.push(fromName.replace(/([a-z])([A-Z])|([A-Z])([A-Z][a-z])/g, "$1$3 $2$4").replace(SENDER_NOISE, " "));
  found.push(...domainNames(fromAddress));
  return tidy(found, cleanCompany, isCompany, normalizeCompany);
}

function roleCandidates({ subject, text, links = [] }: SuggestionSource, known: (string | null)[]) {
  const found = [...known.filter((value): value is string => !!value), ...jobLinkTexts(links, JOB_LINK)];
  const haystack = `${subject}\n${text}`;
  const patterns = [
    new RegExp(String.raw`\b(?:position|role|vacancy) of\s+(.{3,90}?)${ROLE_END}`, "gi"),
    new RegExp(
      String.raw`\b(?:for|to|in) (?:the |our )?(.{3,90}?)\s+(?:role|position|job|vacancy|opportunity|programme|program)\b`,
      "gi",
    ),
    new RegExp(String.raw`\b(?:application|applying|applied|apply) for (?:the |our )?(.{3,90}?)${ROLE_END}`, "gi"),
    new RegExp(String.raw`\binterest in (?:the |our )?(.{3,90}?)\s+(?:at|with)\s`, "gi"),
  ];
  for (const pattern of patterns) for (const [, role] of haystack.matchAll(pattern)) found.push(role);
  found.push(...subject.split(SUBJECT_PARTS));
  return tidy(found, cleanRole, isRole);
}

function jobLinkTexts(links: { url: string; text: string }[], pattern: RegExp) {
  return links
    .filter((link) => pattern.test(link.url) && link.text && !GENERIC_LINK_TEXT.test(link.text))
    .map((link) => cleanRole(link.text))
    .filter(isRole);
}

export function isCompany(name: string | null): name is string {
  return (
    !!name &&
    !SENTENCE_WORDS.test(name) &&
    !JOB_BOARD_WORDS.test(name) &&
    !NOT_A_NAME.test(name) &&
    !TIME_OR_NUMBER.test(name)
  );
}

export function isRole(role: string | null): role is string {
  if (!role) return false;
  return (
    role.split(/\s+/).length <= MAX_ROLE_WORDS &&
    !SENTENCE_WORDS.test(role) &&
    !JOB_BOARD_WORDS.test(role) &&
    !NOT_A_ROLE.test(role) &&
    !ROLE_FILLER.test(role)
  );
}

function domainNames(address: string) {
  const [local, domain = ""] = address.split("@");
  if (JOB_BOARD_DOMAINS.test(domain)) return SENDER_NOISE.test(local) ? [] : [local];
  const labels = domain.split(".");
  return [labels.length > 2 && labels.at(-2)!.length <= 3 ? labels.at(-3)! : (labels.at(-2) ?? "")];
}

function cleanCompany(name: string) {
  return name
    .split(/[.!?,]\s|\s(?:Dear|Hello|Hi|Hey|Thank|Thanks|We|Your)\b/)[0]
    .replace(/\s+/g, " ")
    .replace(/^(the|to|at|with)\s+/i, "")
    .replace(/[\s.,!:;'’-]+$/, "")
    .replace(/\s+(team|careers|recruiting|talent|and|&)$/i, "")
    .replace(/\s+(?:interview|invitation|invite|application|assessment|offer|update|confirmation|next steps)\b.*$/i, "")
    .trim();
}

function cleanRole(role: string) {
  return role
    .replace(/^.*\b(?:apply|applying|applied|interest in|application for)\s+(?:to|for|in)?\s*/i, "")
    .replace(/\s+(?:has|have|was|is)\s+(?:been|now)\b.*$/i, "")
    .replace(/\s+(?:at|with)\s*$/i, "")
    .replace(/\s+(?:role|position|job|vacancy)$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an|our|position of)\s+/i, "")
    .replace(/^(?:[A-Z]{1,3}\d{4,}|\d{5,})\s+/, "")
    .replace(/\s+\(?(?:[A-Z]{1,4}-?\d{4,}|\d{5,})\)?$/, "")
    .replace(/\s*\((?:ID|ref|req)[^)]*\)?$/i, "")
    .replace(/[\s.,!:;-]+$/, "")
    .trim();
}

function tidy(
  values: string[],
  clean: (value: string) => string,
  keep: (value: string) => boolean,
  keyOf: (value: string) => string = (value) => value.toLowerCase(),
) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = clean(raw);
    const key = keyOf(value);
    if (value.length < 2 || value.length > 90 || !keep(value) || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}
