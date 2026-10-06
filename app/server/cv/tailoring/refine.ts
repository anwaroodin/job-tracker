import type { CvContent, JobKeywords, ResumeChange, SkillTarget } from "~/types/cv";
import { list, obj, str, strings } from "../clean";
import { contentText, jdSkillIndex, keywordInText, normalizeSkillKey } from "./keywords";

export const MAX_NOTE_CHARS = 4000;

export function verifySkillPlan(raw: unknown, cv: CvContent, jk: JobKeywords, jobDescription: string) {
  const existing = new Map(cv.skills.flatMap((g) => g.items).map((s) => [normalizeSkillKey(s), s]));
  const jdSkills = jdSkillIndex(jk, jobDescription);
  const text = contentText(cv);
  const accepted: SkillTarget[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const target of list(obj(raw).target_skills)) {
    const skill = str(obj(target).skill, 80);
    const reason = str(obj(target).reason, 300);
    const key = normalizeSkillKey(skill);
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    if (existing.has(key)) accepted.push({ skill: existing.get(key)!, source: "existing", reason: reason || "Already in your skills" });
    else if (jdSkills.has(key)) accepted.push({ skill: jdSkills.get(key)!, source: "jd_added", reason: reason || "Required or preferred by the job" });
    else if (keywordInText(skill, text)) accepted.push({ skill, source: "supported_by_resume", reason: reason || "Appears in your CV" });
    else rejected.push(skill);
  }
  return { accepted, rejected, notes: str(obj(raw).strategy_notes, MAX_NOTE_CHARS) };
}

export function mergeInjected(current: CvContent, raw: unknown): CvContent {
  const r = obj(raw);
  const out = structuredClone(current);
  const summary = str(r.summary, 1500);
  if (summary) out.summary = summary;

  const bullets = (entries: unknown, index: number) => strings(obj(list(entries)[index]).description, 1500);
  out.experience.forEach((role, i) => {
    const next = bullets(r.workExperience, i);
    if (next.length === role.bullets.length) role.bullets = role.bullets.map((b, j) => ({ ...b, text: next[j] }));
  });
  out.projects.forEach((project, i) => {
    const next = bullets(r.personalProjects, i);
    if (next.length === project.bullets.length) project.bullets = project.bullets.map((b, j) => ({ ...b, text: next[j] }));
  });
  out.education.forEach((school, i) => {
    const next = bullets(r.education, i);
    if (next.length === school.details.length) school.details = next;
  });
  return out;
}

export function textSlots(cv: CvContent) {
  const slots = new Map<string, string>([["summary", cv.summary]]);
  cv.experience.forEach((e, i) => e.bullets.forEach((b, j) => slots.set(`workExperience[${i}].description[${j}]`, b.text)));
  cv.projects.forEach((p, i) => p.bullets.forEach((b, j) => slots.set(`personalProjects[${i}].description[${j}]`, b.text)));
  cv.education.forEach((e, i) => e.details.forEach((d, j) => slots.set(`education[${i}].description[${j}]`, d)));
  return slots;
}

export function withInjectedEdits(edits: ResumeChange[], master: CvContent, before: CvContent, after: CvContent): ResumeChange[] {
  const original = textSlots(master);
  const previous = textSlots(before);
  const out = edits.map((e) => ({ ...e }));
  for (const [path, value] of textSlots(after)) {
    if (value === previous.get(path)) continue;
    const existing = out.find((e) => e.path === path && e.action === "replace");
    if (existing) existing.value = value;
    else out.push({ path, action: "replace", original: original.get(path) ?? null, value, reason: "Worked a missing job keyword back in." });
  }
  return out;
}

const AI_PHRASE_REPLACEMENTS: Record<string, string> = {
  spearheaded: "led",
  orchestrated: "coordinated",
  championed: "advocated for",
  synergized: "collaborated",
  leveraged: "used",
  revolutionized: "transformed",
  pioneered: "introduced",
  catalyzed: "initiated",
  operationalized: "implemented",
  architected: "designed",
  envisioned: "planned",
  effectuated: "completed",
  endeavored: "worked",
  facilitated: "helped",
  utilized: "used",
  synergy: "collaboration",
  synergies: "collaborations",
  "paradigm shift": "change",
  paradigm: "approach",
  "best-in-class": "top-performing",
  "world-class": "high-quality",
  "cutting-edge": "modern",
  "bleeding-edge": "modern",
  "game-changer": "innovation",
  "game-changing": "innovative",
  disruptive: "innovative",
  disruptor: "",
  holistic: "comprehensive",
  robust: "strong",
  scalable: "expandable",
  actionable: "practical",
  impactful: "effective",
  proactively: "actively",
  proactive: "active",
  stakeholder: "team member",
  deliverables: "outputs",
  bandwidth: "capacity",
  "circle back": "follow up",
  "deep dive": "analysis",
  "move the needle": "make progress",
  "low-hanging fruit": "quick wins",
  "touch base": "connect",
  "value-add": "benefit",
  "in order to": "to",
  "for the purpose of": "to",
  "with a view to": "to",
  "at the end of the day": "",
  "moving forward": "",
  "going forward": "",
  "on a daily basis": "daily",
  "on a regular basis": "regularly",
  "in a timely manner": "promptly",
  "at this point in time": "now",
  "due to the fact that": "because",
  "in the event that": "if",
  "in light of the fact that": "since",
  "—": ", ",
  "---": ", ",
  "--": ", ",
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrasePattern = (phrase: string) => new RegExp(/\w/.test(phrase) ? `(?<!\\w)${escape(phrase)}(?!\\w)` : escape(phrase), "gi");
const matchCase = (found: string, replacement: string) => (/^[A-Z]/.test(found) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement);

export function removeAiPhrases(cv: CvContent, jobDescription: string) {
  const jd = jobDescription.toLowerCase();
  const active = Object.entries(AI_PHRASE_REPLACEMENTS)
    .filter(([phrase]) => !jd.includes(phrase))
    .map(([phrase, replacement]) => [phrase, replacement, phrasePattern(phrase)] as const);
  const removed = new Set<string>();
  const clean = (text: string) =>
    active
      .reduce((out, [phrase, replacement, pattern]) => {
        if (out.search(pattern) === -1) return out;
        removed.add(phrase);
        return out.replace(pattern, (found) => matchCase(found, replacement)).replace(/\s{2,}/g, " ").replace(/\s+,/g, ",");
      }, text)
      .trim();

  const out = structuredClone(cv);
  out.summary = clean(out.summary);
  for (const entry of [...out.experience, ...out.projects]) entry.bullets = entry.bullets.map((b) => ({ ...b, text: clean(b.text) }));
  for (const school of out.education) school.details = school.details.map(clean);
  return { cv: out, removed: [...removed] };
}

export function alignWithMaster(cv: CvContent, master: CvContent, jk: JobKeywords, jobDescription: string) {
  const masterSkills = new Set(master.skills.flatMap((g) => g.items).map(normalizeSkillKey));
  const masterText = contentText(master);
  const allowed = jdSkillIndex(jk, jobDescription);
  const removed: string[] = [];
  const out = structuredClone(cv);
  out.skills = out.skills.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const key = normalizeSkillKey(item);
      const keep = masterSkills.has(key) || allowed.has(key) || keywordInText(item, masterText);
      if (!keep) removed.push(item);
      return keep;
    }),
  }));
  const masterCerts = new Set(master.certifications.map(normalizeSkillKey));
  out.certifications = out.certifications.filter((c) => {
    const keep = masterCerts.has(normalizeSkillKey(c));
    if (!keep) removed.push(c);
    return keep;
  });
  return { cv: out, removed };
}
