import { type Contact, cleanContacts } from "~/lib/contacts";

const SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const TIMEOUT_MS = 15_000;
const RESULTS_PER_QUERY = 10;

interface SearchResult {
  title?: unknown;
  url?: unknown;
  description?: unknown;
}

const plain = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .trim()
    : "";

const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const LABELLED_SEGMENT = /^(experience|education|location|connections?|followers?)\s*:/i;
const ROLE_WORDS = /\b(manager|engineer|engineering|recruit\w*|talent|head|director|lead|developer|designer|partner|officer|founder|vp|president|analyst|specialist|consultant|chief|cto|ceo|coordinator|associate|intern)\b/i;
const AT_COMPANY = /\s+(?:at|@)\s+(.+)$/i;

const segments = (description: string) => description.split(/\s+·\s+/).map((segment) => segment.trim());

const labelled = (description: string, label: string) =>
  segments(description)
    .find((segment) => segment.toLowerCase().startsWith(`${label}:`))
    ?.slice(label.length + 1)
    .replace(/\.\s.*$/, "")
    .trim() ?? "";

function openingRole(description: string) {
  const opening = segments(description)[0].split(/(?<=[a-z])\.\s/)[0];
  return LABELLED_SEGMENT.test(opening) || opening.length > 120 ? "" : opening;
}

function currentCompany(titleParts: string[], description: string) {
  const experience = labelled(description, "experience");
  if (experience) return experience;
  const last = titleParts.at(-1) ?? "";
  if (last && !last.endsWith("...") && (titleParts.length > 1 || !ROLE_WORDS.test(last))) return last;
  return [...titleParts, openingRole(description)].map((part) => part.match(AT_COMPANY)?.[1] ?? "").find(Boolean) ?? "";
}

function roleFrom(titleParts: string[], description: string, companyKey: string) {
  const roles = titleParts.map((part) => part.replace(AT_COMPANY, ""));
  const fromTitle = roles.find((part) => !squash(part).includes(companyKey) && ROLE_WORDS.test(part));
  const role = (fromTitle ?? openingRole(description).replace(AT_COMPANY, "")).replace(/\s*(\.\.\.|…)$/, "").trim();
  return squash(role).includes(companyKey) ? "" : role;
}

export function profilesFromResults(results: SearchResult[], company: string): Contact[] {
  const companyKey = squash(company);
  if (!companyKey) return [];
  const people = results.flatMap((result) => {
    const title = plain(result.title).replace(/\s*\|\s*LinkedIn.*$/i, "");
    const description = plain(result.description);
    const [name = "", ...rest] = title.split(/\s+[-–—]\s+/);
    if (!name || !squash(currentCompany(rest, description)).includes(companyKey)) return [];
    return [{ name, profileUrl: plain(result.url), degree: "", headline: roleFrom(rest, description, companyKey), note: labelled(description, "location") }];
  });
  return cleanContacts(people);
}

export function profileQuery(company: string, titles: string[]) {
  return `site:linkedin.com/in "${company.replace(/"/g, "")}" (${titles.map((title) => `"${title}"`).join(" OR ")})`;
}

export async function braveFindProfiles(env: Env, company: string, titles: string[]) {
  if (!env.BRAVE_SEARCH_API_KEY) return null;
  const params = new URLSearchParams({ q: profileQuery(company, titles), count: String(RESULTS_PER_QUERY) });
  try {
    const res = await fetch(`${SEARCH_URL}?${params}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: { web?: { results?: unknown } } = await res.json();
    return Array.isArray(body.web?.results) ? profilesFromResults(body.web.results, company) : [];
  } catch {
    return null;
  }
}
