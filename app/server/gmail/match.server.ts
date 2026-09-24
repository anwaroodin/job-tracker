export interface MatchableEmail {
  subject: string;
  snippet: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
}

export interface MatchableApplication {
  id: string;
  company: string;
  role: string;
  appliedAt: string;
}

const COMPANY_NOISE = new Set([
  "ltd", "limited", "inc", "llc", "llp", "plc", "corp", "corporation", "co",
  "company", "group", "holdings", "gmbh", "the", "uk",
]);
const ROLE_NOISE = new Set(["and", "the", "for", "with", "of", "in", "senior", "junior", "graduate", "intern"]);
const DAY = 86_400_000;

const CLOCK_SKEW_MS = 2 * DAY;

const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const words = (s: string) => normalize(s).split(" ").filter((w) => w && w !== "and");

function companyKey(company: string) {
  const all = words(company);
  const kept = all.filter((w) => !COMPANY_NOISE.has(w));
  return (kept.length ? kept : all).join("");
}

// every run of up to 5 words in a row, glued together. comparing against these
// instead of a substring search means "able" never matches inside "available"
function wordRuns(ws: string[]) {
  const runs = new Set<string>();
  for (let i = 0; i < ws.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(ws.length, i + 5); j++) runs.add((joined += ws[j]));
  }
  return runs;
}

export function matchApplication<A extends MatchableApplication>(
  email: MatchableEmail,
  apps: A[],
): A | null {
  const domainLabels = (email.fromAddress.split("@")[1] ?? "")
    .split(".")
    .map((l) => l.replace(/[^a-z0-9]/g, ""));
  const runs = wordRuns(words(`${email.fromName} ${email.subject} ${email.snippet}`));
  const senderWords = words(email.fromName);
  const text = ` ${normalize(`${email.subject} ${email.snippet}`)} `;
  const received = Date.parse(email.receivedAt);

  const candidates = apps.filter((app) => {
    if (Date.parse(app.appliedAt) > received + CLOCK_SKEW_MS) return false;
    const key = companyKey(app.company);
    if (key.length < 2) return false;
    if (runs.has(key)) return true;
    const prefixOf = (w: string) => w === key || (key.length >= 5 && w.startsWith(key));
    return domainLabels.some(prefixOf) || senderWords.some(prefixOf);
  });
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) {
    const byRole = apps.filter((app) => {
      const role = normalize(app.role);
      return (
        role.length >= 8 &&
        text.includes(` ${role} `) &&
        Math.abs(Date.parse(app.appliedAt) - received) <= CLOCK_SKEW_MS
      );
    });
    return byRole.length === 1 ? byRole[0] : null;
  }

  // could be more than one role at a company, so go with whichever role the email
  // mentions, otherwise the latest application
  const roleScore = (app: A) =>
    normalize(app.role)
      .split(" ")
      .filter((w) => w.length > 2 && !ROLE_NOISE.has(w))
      .filter((w) => text.includes(` ${w} `)).length;

  return candidates.reduce((best, app) => {
    const diff = roleScore(app) - roleScore(best);
    if (diff !== 0) return diff > 0 ? app : best;
    return app.appliedAt > best.appliedAt ? app : best;
  });
}
