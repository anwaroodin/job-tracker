import type { CvContent } from "~/types/cv";
import { textSlots } from "./refine";

const PRONOUN = /\b(I|me|my|we|our|he|she|they)\b/;
const ARTICLE = /\b(a|an|the)\b/;
const NUMBER = /\d[\d,.]*(?:\s?(?:%|k|m|x|\+))?/gi;
const MAX_OPENER_USES = 2;
const MIN_WORDS = 8;
const MAX_WORDS = 28;

const isBullet = (path: string) => /^(workExperience|personalProjects)\[\d+\]\.description\[\d+\]$/.test(path);
const opener = (text: string) => text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z-]/g, "") ?? "";

export function writingAudit(cv: CvContent) {
  const bullets = [...textSlots(cv)].filter(([path]) => isBullet(path));
  const openers = new Map<string, number>();
  const numbers = new Map<string, string>();
  const issues = new Map<string, string[]>();
  const flag = (path: string, issue: string) => issues.set(path, [...(issues.get(path) ?? []), issue]);

  for (const [path, text] of bullets) {
    const verb = opener(text);
    const uses = (openers.get(verb) ?? 0) + 1;
    openers.set(verb, uses);
    if (uses > MAX_OPENER_USES) flag(path, `opens with "${verb}", already used ${MAX_OPENER_USES} times`);

    const pronoun = text.match(PRONOUN)?.[1];
    if (pronoun) flag(path, `pronoun "${pronoun}"`);
    const article = text.match(ARTICLE)?.[1];
    if (article) flag(path, `article "${article}"`);

    const words = text.trim().split(/\s+/).length;
    if (words > MAX_WORDS) flag(path, `${words} words, aim for 12 to 25`);
    if (words < MIN_WORDS) flag(path, `only ${words} words, says too little`);

    const figures = [...new Set((text.match(NUMBER) ?? []).map((n) => n.toLowerCase().replace(/\s/g, "")))];
    if (!figures.length) flag(path, "no number; add one only if the CV or answers support it");
    for (const figure of figures) {
      const first = numbers.get(figure);
      if (first) flag(path, `repeats "${figure}" from ${first}`);
      else numbers.set(figure, path);
    }
  }

  return [...issues].map(([path, list]) => `- ${path}: ${list.join("; ")}`).join("\n") || "None. Every bullet passes the mechanical checks.";
}

export function resumeLines(cv: CvContent) {
  const lines = [`summary: ${cv.summary}`];
  cv.experience.forEach((e, i) => {
    lines.push(`workExperience[${i}]: ${e.title} at ${e.company}`);
    e.bullets.forEach((b, j) => lines.push(`  workExperience[${i}].description[${j}]: ${b.text}`));
  });
  cv.projects.forEach((p, i) => {
    lines.push(`personalProjects[${i}]: ${p.name}${p.details ? ` (${p.details})` : ""}`);
    p.bullets.forEach((b, j) => lines.push(`  personalProjects[${i}].description[${j}]: ${b.text}`));
  });
  cv.education.forEach((e, i) => {
    lines.push(`education[${i}]: ${e.qualification}, ${e.institution}`);
    e.details.forEach((d, j) => lines.push(`  education[${i}].description[${j}]: ${d}`));
  });
  cv.skills.forEach((g, i) => lines.push(`skills[${i}] (${g.label}): ${g.items.join(", ")}`));
  if (cv.certifications.length) lines.push(`certifications: ${cv.certifications.join("; ")}`);
  return lines.join("\n");
}
