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

function companyKey(company: string) {
  const words = normalize(company).split(" ").filter((w) => w && !COMPANY_NOISE.has(w));
  return words.length ? words.join(" ") : normalize(company);
}

export function matchApplication<A extends MatchableApplication>(
  email: MatchableEmail,
  apps: A[],
): A | null {
  const domainLabels = (email.fromAddress.split("@")[1] ?? "")
    .split(".")
    .map((l) => l.replace(/[^a-z0-9]/g, ""));
  const hay = ` ${normalize(`${email.fromName} ${email.subject} ${email.snippet}`)} `;
  const text = ` ${normalize(`${email.subject} ${email.snippet}`)} `;
  const received = Date.parse(email.receivedAt);

  const candidates = apps.filter((app) => {
    if (Date.parse(app.appliedAt) > received + CLOCK_SKEW_MS) return false;
    const key = companyKey(app.company);
    if (key.length < 2) return false;
    return hay.includes(` ${key} `) || domainLabels.includes(key.replace(/ /g, ""));
  });
  if (candidates.length <= 1) return candidates[0] ?? null;

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
