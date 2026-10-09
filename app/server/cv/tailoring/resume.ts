import { newId } from "~/lib/cv";
import type { CvContent, ResumeChange, SkillTarget } from "~/types/cv";
import { list, obj } from "../clean";
import { keywordInText, normalizeSkillKey } from "./keywords";

const MIN_PROJECTS = 3;

const dates = (start: string, end: string | null) => [start, end ?? "Present"].filter(Boolean).join(" - ");

export function resumeView(cv: CvContent) {
  return {
    summary: cv.summary,
    workExperience: cv.experience.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      years: dates(e.start, e.end),
      description: e.bullets.map((b) => b.text),
    })),
    personalProjects: cv.projects.map((p) => ({
      name: p.name,
      technologies: p.details,
      description: p.bullets.map((b) => b.text),
      ...(p.optional && { optional: true }),
    })),
    education: cv.education.map((e) => ({
      institution: e.institution,
      degree: e.qualification,
      years: dates(e.start, e.end),
      description: e.details,
    })),
    skills: cv.skills.map((g) => ({ label: g.label, items: g.items })),
    certifications: cv.certifications,
  };
}

export function chooseProjects(raw: unknown, cv: CvContent): number[] {
  const shown = cv.projects.flatMap((p, i) => (p.optional ? [] : [i]));
  const picked = [...new Set(list(obj(raw).projects).filter((i): i is number => Number.isInteger(i) && i >= 0 && i < cv.projects.length))];
  return picked.length ? picked.slice(0, Math.max(shown.length, MIN_PROJECTS)) : shown;
}

export function withProjects(cv: CvContent, indices: number[]): CvContent {
  const projects = indices.filter((i) => i < cv.projects.length).map((i) => ({ ...cv.projects[i], optional: undefined }));
  return { ...cv, projects };
}

type Slot =
  | { kind: "text"; get: () => string; set: (value: string) => void }
  | { kind: "list"; items: string[]; append: (value: string) => void; set: (items: string[]) => void };

const SECTIONS = { workExperience: "experience", personalProjects: "projects" } as const;

function slot(cv: CvContent, path: string): Slot | null {
  if (path === "summary") return { kind: "text", get: () => cv.summary, set: (v) => (cv.summary = v) };
  if (path === "certifications") {
    return { kind: "list", items: cv.certifications, append: () => {}, set: (items) => (cv.certifications = items) };
  }

  const bullet = /^(workExperience|personalProjects)\[(\d+)\]\.description(?:\[(\d+)\])?$/.exec(path);
  if (bullet) {
    const entry = cv[SECTIONS[bullet[1] as keyof typeof SECTIONS]][Number(bullet[2])];
    if (!entry) return null;
    if (bullet[3] === undefined) {
      return { kind: "list", items: entry.bullets.map((b) => b.text), append: (v) => entry.bullets.push({ id: newId(), text: v }), set: () => {} };
    }
    const b = entry.bullets[Number(bullet[3])];
    return b ? { kind: "text", get: () => b.text, set: (v) => (b.text = v) } : null;
  }

  const detail = /^education\[(\d+)\]\.description\[(\d+)\]$/.exec(path);
  if (detail) {
    const entry = cv.education[Number(detail[1])];
    const j = Number(detail[2]);
    return entry && j < entry.details.length ? { kind: "text", get: () => entry.details[j], set: (v) => (entry.details[j] = v) } : null;
  }

  const skills = /^skills\[(\d+)\]\.items$/.exec(path);
  if (skills) {
    const group = cv.skills[Number(skills[1])];
    return group ? { kind: "list", items: group.items, append: (v) => group.items.push(v), set: (items) => (group.items = items) } : null;
  }
  return null;
}

const same = (a: string, b: string | null) => a.trim().toLowerCase() === (b ?? "").trim().toLowerCase();

function reordered(current: string[], proposed: string[], allowNew: (item: string) => boolean) {
  const byKey = new Map<string, string[]>();
  for (const item of current) byKey.set(item.toLowerCase(), [...(byKey.get(item.toLowerCase()) ?? []), item]);
  const out: string[] = [];
  const added = new Set<string>();
  for (const item of proposed) {
    const key = item.toLowerCase();
    const bucket = byKey.get(key);
    if (bucket?.length) out.push(bucket.shift()!);
    else if (!bucket && !added.has(key) && allowNew(item)) {
      out.push(item.trim());
      added.add(key);
    }
  }
  for (const bucket of byKey.values()) out.push(...bucket);
  return out;
}

export function applyDiffs(original: CvContent, changes: ResumeChange[], skillTargets: SkillTarget[], allowAppend: boolean) {
  const result = structuredClone(original);
  const allowedSkills = new Set(skillTargets.map((t) => normalizeSkillKey(t.skill)));
  const applied: ResumeChange[] = [];
  const rejected: ResumeChange[] = [];

  for (const change of changes) {
    const target = slot(result, change.path);
    const ok = (() => {
      if (!target) return false;
      if (change.action === "replace") {
        if (target.kind !== "text" || typeof change.value !== "string" || !change.value.trim()) return false;
        if (!same(target.get(), change.original)) return false;
        target.set(change.value.trim());
        return true;
      }
      if (target.kind !== "list") return false;
      if (change.action === "append") {
        const isBulletList = /\.description$/.test(change.path);
        if (!allowAppend || !isBulletList || typeof change.value !== "string" || !change.value.trim()) return false;
        target.append(change.value.trim());
        return true;
      }
      if (change.action === "reorder") {
        const isSkills = change.path.startsWith("skills[");
        if (!Array.isArray(change.value) || !(isSkills || change.path === "certifications")) return false;
        target.set(reordered(target.items, change.value, (item) => isSkills && allowedSkills.has(normalizeSkillKey(item))));
        return true;
      }
      if (change.action === "add_skill") {
        const skill = typeof change.value === "string" ? change.value.trim() : "";
        if (!change.path.startsWith("skills[") || !skill) return false;
        if (target.items.some((item) => same(item, skill)) || !allowedSkills.has(normalizeSkillKey(skill))) return false;
        target.append(skill);
        return true;
      }
      return false;
    })();
    (ok ? applied : rejected).push(change);
  }
  return { result, applied, rejected };
}

const METRIC = /\d+(?:\.\d+)?%|\d+(?:\.\d+)?x\b|[$£€]\d[\d,.]*/gi;
const MAX_WORD_RATIO = 1.8;

const descriptionWords = (cv: CvContent) =>
  [cv.summary, ...cv.experience.flatMap((e) => e.bullets.map((b) => b.text)), ...cv.projects.flatMap((p) => p.bullets.map((b) => b.text))]
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;

function where(cv: CvContent, path: string) {
  const bullet = /^(workExperience|personalProjects|education)\[(\d+)\]\.description\[(\d+)\]$/.exec(path);
  if (!bullet) return path === "summary" ? "the summary" : path;
  const i = Number(bullet[2]);
  const name = bullet[1] === "workExperience" ? cv.experience[i]?.company : bullet[1] === "personalProjects" ? cv.projects[i]?.name : cv.education[i]?.institution;
  return `${name || "an entry"}, bullet ${Number(bullet[3]) + 1}`;
}

export function verifyDiffResult(original: CvContent, result: CvContent, applied: ResumeChange[], knownText: string, jobTerms: string[] = []) {
  if (!applied.length) return ["No changes were applied, so the CV is unchanged."];
  const warnings: string[] = [];
  const before = descriptionWords(original);
  const after = descriptionWords(result);
  if (before > 0 && after > before * MAX_WORD_RATIO) {
    warnings.push(`Word count increased significantly: ${before} → ${after} (${(after / before).toFixed(1)}x).`);
  }
  for (const change of applied) {
    if (typeof change.value !== "string" || (change.action !== "replace" && change.action !== "append")) continue;
    const old = new Set(`${knownText}\n${change.original ?? ""}`.match(METRIC) ?? []);
    const invented = [...new Set(change.value.match(METRIC) ?? [])].filter((m) => !old.has(m));
    if (invented.length) warnings.push(`Possible invented number in ${where(result, change.path)}: ${invented.join(", ")} (not in the original).`);
    const unbacked = jobTerms.filter((term) => keywordInText(term, change.value as string) && !keywordInText(term, knownText));
    if (unbacked.length) warnings.push(`Not backed by your CV or answers, in ${where(result, change.path)}: ${unbacked.join(", ")}.`);
  }
  return warnings;
}
