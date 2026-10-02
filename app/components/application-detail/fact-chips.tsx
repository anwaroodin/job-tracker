import { cn } from "~/lib/cn";

type Tone = "default" | "salary" | "applicants";

export interface Fact {
  key: string;
  text: string;
  tone?: Tone;
}

/** Same tones as the extension's quick-view chips: salary green, applicants amber. */
const TONES: Record<Tone, string> = {
  default: "border-stroke-primary text-text-secondary",
  salary: "border-green-tertiary text-green-primary",
  applicants: "border-accent-tertiary text-accent-primary",
};

const DAY_MS = 86_400_000;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
];
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * "Posted 3 days ago", from the date the extension worked out from the
 * listing's own "3 days ago". That's only day-accurate, so anything under a
 * day reads "today".
 */
export function postedAgo(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();
  const match = UNITS.find(([, ms]) => elapsed >= ms);
  if (!match) return "Posted today";
  const [unit, ms] = match;
  return `Posted ${relative.format(-Math.floor(elapsed / ms), unit)}`;
}

/** An application's listing facts as chips, skipping the ones it doesn't have. */
export function listingFacts(job: {
  location: string;
  workType: string;
  employmentType?: string;
  salary: string;
  postedAt?: string | null;
  applicants?: string;
}): Fact[] {
  const facts: Fact[] = [
    { key: "location", text: job.location },
    { key: "workType", text: job.workType },
    { key: "employment", text: job.employmentType ?? "" },
    { key: "salary", text: job.salary, tone: "salary" },
    { key: "posted", text: job.postedAt ? postedAgo(job.postedAt) : "" },
    { key: "applicants", text: job.applicants ?? "", tone: "applicants" },
  ];
  return facts.filter((f) => f.text);
}

/** Hairline pills for a listing's facts, matching the extension's quick view. */
export function FactChips({ facts, className }: { facts: Fact[]; className?: string }) {
  if (!facts.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {facts.map((fact) => (
        <li
          key={fact.key}
          className={cn("border px-2 py-1 text-[10.5px] uppercase tracking-[0.04em]", TONES[fact.tone ?? "default"])}
        >
          {fact.text}
        </li>
      ))}
    </ul>
  );
}
