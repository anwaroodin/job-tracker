export interface JobFromPdf {
  company: string;
  role: string;
  location: string;
  salary: string;
  workType: string;
  employmentType: string;
  description: string;
}

const FIELDS: [keyof JobFromPdf, RegExp][] = [
  ["company", /^(company|company name|employer|organisation|organization|client|hiring company)$/i],
  ["role", /^(job title|position|role|title|vacancy|position title|job)$/i],
  ["location", /^(location|based in|office|office location|work location|base)$/i],
  ["salary", /^(salary|compensation|pay|rate|remuneration|salary range|package|day rate)$/i],
  ["employmentType", /^(employment type|job type|contract|contract type|type|hours)$/i],
  ["workType", /^(work type|working pattern|work model|workplace|working arrangement|remote)$/i],
];

const SALARY = /(?:[£$€]\s?\d[\d,.]*\s?k?(?:\s?(?:-|–|to)\s?[£$€]?\s?\d[\d,.]*\s?k?)?(?:\s?(?:per|\/|a)\s?(?:annum|year|yr|day|hour|month))?|\d[\d,.]*\s?k?\s?(?:-|–|to)\s?\d[\d,.]*\s?k?\s?(?:GBP|USD|EUR))/i;
const WORK_TYPE = /\b(fully remote|remote|hybrid|on-?site|in[- ]office)\b/i;
const EMPLOYMENT = /\b(full[- ]time|part[- ]time|permanent|fixed[- ]term|contract|internship|temporary|freelance)\b/i;
const HEADING = /^(about (the )?(role|job|position|you|us)|the role|role overview|job description|responsibilities|requirements|what you'll do|who you are|overview)\b/i;
const COMPANY_SENTENCE = /^(?:at\s+)?([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})\s+(?:is|are)\s+(?:a|an|the)\s/;
const ABOUT_COMPANY = /^about\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})\s*:?$/;
const JOIN_OR_AT = /\b(?:[Jj]oin|[Aa]t|[Ww]ith)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/g;
const MAX_CANDIDATES = 15;
const ROLE_LINES = 40;

const tidy = (value: string) => value.replace(/\s+/g, " ").replace(/^[\s:–-]+|[\s.,;]+$/g, "").trim();
const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

function labelled(lines: string[]) {
  const found: Partial<JobFromPdf> = {};
  lines.forEach((line, i) => {
    const [label, ...rest] = line.split(/:\s*/);
    const field = FIELDS.find(([, match]) => match.test(label.trim()))?.[0];
    if (!field || found[field]) return;
    const value = tidy(rest.join(": ") || (line.trim().endsWith(":") ? (lines[i + 1] ?? "") : ""));
    if (value && value.length <= 120) found[field] = value;
  });
  return found;
}

const NOT_A_COMPANY = /^(you|we|this|the|our|it|they|role|job|position|us|about|join|team|company)$/i;

export function companyCandidates(lines: string[]) {
  const names = new Set<string>();
  for (const line of lines) {
    for (const match of [line.match(ABOUT_COMPANY), line.match(COMPANY_SENTENCE), ...line.matchAll(JOIN_OR_AT)]) {
      const name = match?.[1]?.trim();
      if (name && !NOT_A_COMPANY.test(name)) names.add(name);
    }
  }
  return [...names].slice(0, MAX_CANDIDATES);
}

export const roleCandidates = (lines: string[]) =>
  lines
    .slice(0, ROLE_LINES)
    .filter((line) => line.length <= 90 && !line.includes(":") && !HEADING.test(line) && !SALARY.test(line) && !/[.!?]$/.test(line) && /[a-z]/i.test(line))
    .slice(0, MAX_CANDIDATES);

export function jobLines(text: string) {
  const description = text
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { description, lines: description.split("\n").map((line) => line.trim()).filter(Boolean) };
}

export function readJobText(text: string) {
  const { description, lines } = jobLines(text);
  const found = labelled(lines);
  const work = found.workType ?? description.match(WORK_TYPE)?.[1] ?? "";
  const employment = found.employmentType ?? description.match(EMPLOYMENT)?.[1] ?? "";
  const job: JobFromPdf = {
    company: found.company ?? companyCandidates(lines)[0] ?? "",
    role: found.role ?? tidy(roleCandidates(lines)[0] ?? ""),
    location: found.location ?? "",
    salary: found.salary ?? tidy(description.match(SALARY)?.[0] ?? ""),
    workType: work ? capitalise(work.replace(/in[- ]office/i, "on-site")) : "",
    employmentType: employment ? capitalise(employment.replace(/\s+/, "-")) : "",
    description,
  };
  return { job, labelled: new Set(Object.keys(found) as (keyof JobFromPdf)[]), lines };
}
