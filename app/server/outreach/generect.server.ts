import type { EmailStatus } from "~/lib/contacts";
import type { NameParts } from "~/lib/email-pattern";

const FIND_URL = "https://api.generect.com/api/v1/email/find/";
const SEARCH_URL = "https://api.generect.com/api/v1/search/database/leads/";
const TIMEOUT_MS = 30_000;
const EMAIL = /^[a-z0-9._%+-]{1,64}@(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

interface GenerectReply {
  data?: { valid_email?: unknown; result?: unknown; catch_all?: unknown; source?: unknown };
}

export interface GenerectMatch {
  email: string;
  status: EmailStatus;
}

export function parseFindReply(reply: GenerectReply): GenerectMatch | null {
  const data = reply.data;
  const email = typeof data?.valid_email === "string" ? data.valid_email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return null;
  if (data?.catch_all === true) return { email, status: "accept_all" };
  if (data?.source === "FORMAT") return { email, status: "likely" };
  return { email, status: data?.result === "valid" ? "valid" : "unknown" };
}

async function post(apiKey: string, url: string, body: object) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

export interface Charge {
  costUsd: number;
  found: number;
}

const chargeOf = (reply: unknown, found: number): Charge => {
  const charged = (reply as { meta?: { amount_charged?: unknown } } | null)?.meta?.amount_charged;
  return { costUsd: typeof charged === "number" && charged > 0 ? charged : 0, found };
};

async function find(apiKey: string, body: Record<string, string>) {
  const reply = await post(apiKey, FIND_URL, body);
  const match = reply ? parseFindReply(reply as GenerectReply) : null;
  return { match, charge: chargeOf(reply, match ? 1 : 0) };
}

interface Lookup {
  leadId: string | null;
  profileUrl: string;
  name: NameParts;
  domain: string;
}

export async function generectFindEmail(env: Env, person: Lookup) {
  const apiKey = env.GENERECT_API_KEY;
  const charges: Charge[] = [];
  if (!apiKey) return { match: null, charges };
  const attempts: Record<string, string>[] = [];
  if (person.leadId) attempts.push({ lead_id: person.leadId });
  if (person.profileUrl) attempts.push({ linkedin_url: person.profileUrl });
  attempts.push({ first_name: person.name.first, last_name: person.name.last, domain: person.domain });
  for (const body of attempts) {
    const { match, charge } = await find(apiKey, body);
    charges.push(charge);
    if (match) return { match, charges };
  }
  return { match: null, charges };
}

export interface Lead {
  leadId: string;
  name: string;
  title: string;
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function parseLeads(reply: unknown): Lead[] {
  const leads = (reply as { data?: { leads?: unknown } } | null)?.data?.leads;
  if (!Array.isArray(leads)) return [];
  return leads.flatMap((raw: Record<string, unknown>) => {
    const lead = { leadId: text(raw?.id, 200), name: text(raw?.full_name, 120), title: text(raw?.job_title, 200) };
    return lead.leadId && lead.name ? [lead] : [];
  });
}

export async function generectSearchPeople(env: Env, company: string, jobTitles: string[], limit: number) {
  if (!env.GENERECT_API_KEY) return null;
  const body = { company_name: company, job_titles: jobTitles, detail: "thin", skip_truncated_names: true, limit_by: limit };
  const reply = await post(env.GENERECT_API_KEY, SEARCH_URL, body);
  if (!reply) return null;
  const leads = parseLeads(reply);
  return { leads, charge: chargeOf(reply, leads.length) };
}
