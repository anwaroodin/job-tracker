import type { CvContent } from "~/types/cv";
import { list, obj, str, strings } from "../clean";
import { textSlots } from "./refine";

export const EMPHASIS_PROMPT = `A recruiter skims a CV for a few seconds before deciding whether to read it. Choose what to bold so that the skim alone shows why this candidate fits this job.

Job keywords:
{job_keywords}

CV lines, one per line as "path: text":
{lines}

Rules:
1. Bold at most one phrase per line, two only when both are essential.
2. Bold only what this job cares about: a quantified result (for example "cut deploy time by 40%") or a required skill or technology that is central to the line.
3. Leave a line with nothing relevant to this job unbolded. Roughly half the lines or fewer should have any bold.
4. Never bold a whole line, a full sentence, filler, job titles or generic words like "team" or "projects".
5. Each phrase is 1-5 words, copied exactly (same spelling and capitalisation) from its line, and appears only once in that line.
6. Read together, the bold phrases should sum up the candidate's fit for this job.

Output JSON with the lines you chose, each with its path and the phrases to bold.`;

export type Emphasis = Record<string, string[]>;

const MAX_PER_SLOT = 2;
const MAX_WORDS = 6;
const MAX_SHARE = 0.6;

const occurrences = (text: string, phrase: string) => text.split(phrase).length - 1;

export function emphasisSlots(cv: CvContent) {
  return [...textSlots(cv)].filter(([path]) => !path.startsWith("education"));
}

export function verifyEmphasis(cv: CvContent, raw: unknown): Emphasis {
  const slots = new Map(emphasisSlots(cv));
  const out: Emphasis = {};
  for (const item of list(obj(raw).emphasis)) {
    const path = str(obj(item).path, 120);
    const text = slots.get(path);
    if (!text || out[path]) continue;
    const phrases = strings(obj(item).phrases, 80)
      .filter((p) => p.split(/\s+/).length <= MAX_WORDS && p.length <= text.length * MAX_SHARE && occurrences(text, p) === 1)
      .slice(0, MAX_PER_SLOT);
    if (phrases.length) out[path] = phrases;
  }
  return out;
}

export function applyEmphasis(cv: CvContent, emphasis: Emphasis): CvContent {
  const out = structuredClone(cv);
  if (emphasis.summary) out.summaryBold = emphasis.summary;
  const mark = (section: "workExperience" | "personalProjects", entries: { bullets: CvContent["experience"][number]["bullets"] }[]) =>
    entries.forEach((entry, i) =>
      entry.bullets.forEach((bullet, j) => {
        const bold = emphasis[`${section}[${i}].description[${j}]`];
        if (bold) bullet.bold = bold;
      }),
    );
  mark("workExperience", out.experience);
  mark("personalProjects", out.projects);
  return out;
}

export function cleanEmphasis(raw: unknown): Emphasis {
  return Object.fromEntries(
    Object.entries(obj(raw))
      .map(([path, phrases]) => [path.slice(0, 120), strings(phrases, 80).slice(0, MAX_PER_SLOT)] as const)
      .filter(([, phrases]) => phrases.length),
  );
}
