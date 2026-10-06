import type { CvContent } from "~/types/cv";
import { list, obj, str, strings } from "../clean";
import { textSlots } from "./refine";

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
