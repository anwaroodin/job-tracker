import { allSkills } from "~/lib/cv";
import type { AtsScore, CvContent, JobKeywords } from "~/types/cv";
import { obj, str, strings } from "../clean";

const WEIGHTS = { keywordMatch: 0.55, skillsCoverage: 0.25, sectionCompleteness: 0.2 };

export const normalizeSkillKey = (skill: string) => skill.trim().toLowerCase().replace(/\s+/g, " ");

export function cleanJobKeywords(raw: unknown): JobKeywords {
  const r = obj(raw);
  const years = Number(r.experience_years);
  return {
    company: str(r.company),
    role: str(r.role),
    requiredSkills: strings(r.required_skills, 80),
    preferredSkills: strings(r.preferred_skills, 80),
    experienceRequirements: strings(r.experience_requirements),
    educationRequirements: strings(r.education_requirements),
    keyResponsibilities: strings(r.key_responsibilities, 300),
    keywords: strings(r.keywords, 80),
    experienceYears: Number.isFinite(years) && years > 0 ? years : null,
    seniorityLevel: str(r.seniority_level, 40),
  };
}

function allKeywords(jk: JobKeywords) {
  const seen = new Set<string>();
  const out: { term: string; kind: "required" | "preferred" | "keyword" }[] = [];
  const add = (terms: string[], kind: "required" | "preferred" | "keyword") => {
    for (const term of terms) {
      const key = normalizeSkillKey(term);
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ term, kind });
      }
    }
  };
  add(jk.requiredSkills, "required");
  add(jk.preferredSkills, "preferred");
  add(jk.keywords, "keyword");
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function keywordInText(keyword: string, text: string) {
  const term = escape(keyword.trim().toLowerCase());
  return !!term && new RegExp(`(?<!\\w)${term}(?!\\w)`).test(text.toLowerCase());
}

export function contentText(cv: CvContent) {
  return [
    cv.summary,
    ...cv.experience.flatMap((e) => [e.title, e.company, ...e.bullets.map((b) => b.text)]),
    ...cv.projects.flatMap((p) => [p.name, p.subtitle, p.details, ...p.bullets.map((b) => b.text)]),
    ...cv.education.flatMap((e) => [e.institution, e.qualification, ...e.details]),
    ...allSkills(cv),
    ...cv.certifications,
  ].join("\n");
}

export function keywordGaps(jk: JobKeywords, tailoredText: string, masterText: string) {
  const missing = allKeywords(jk)
    .map((k) => k.term)
    .filter((term) => !keywordInText(term, tailoredText));
  return {
    missing,
    injectable: missing.filter((term) => keywordInText(term, masterText)),
  };
}

export function jdSkillIndex(jk: JobKeywords, jobDescription: string) {
  const index = new Map<string, string>();
  for (const skill of [...jk.requiredSkills, ...jk.preferredSkills]) {
    if (keywordInText(skill, jobDescription)) index.set(normalizeSkillKey(skill), skill);
  }
  return index;
}

function recommendations(score: Omit<AtsScore, "recommendations" | "overall" | "keywords">) {
  const tips: string[] = [];
  if (score.keywordMatch < 60 && score.missing.length) tips.push(`Add these high-priority missing keywords: ${score.missing.slice(0, 5).join(", ")}.`);
  if (score.injectable.length) {
    tips.push(`These are in your CV but not in this tailored version, so consider adding them: ${score.injectable.slice(0, 5).join(", ")}.`);
  }
  if (score.skillsCoverage < 60) tips.push("Expand your skills to include more of the tools and technologies the job description lists.");
  if (score.sectionCompleteness < 75) tips.push("Make sure your CV includes all key sections: summary, work experience, education and skills.");
  if (score.keywordMatch >= 80 && score.skillsCoverage >= 80) tips.push("Strong keyword and skills alignment. Consider quantifying your achievements with numbers.");
  if (!tips.length) tips.push("Your CV is well aligned with the job description. Check for any niche certifications or tools to add.");
  return tips;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function atsScore(cv: CvContent, jk: JobKeywords, masterText: string): AtsScore {
  const text = contentText(cv);
  const terms = allKeywords(jk);
  const keywords = terms.map((k) => ({ ...k, found: keywordInText(k.term, text) }));
  const keywordMatch = terms.length ? (keywords.filter((k) => k.found).length / terms.length) * 100 : 0;

  const jdSkills = terms.filter((k) => k.kind !== "keyword").map((k) => k.term);
  const listed = new Set(allSkills(cv).map((s) => s.toLowerCase()));
  const skillsCoverage = jdSkills.length
    ? Math.min(100, (jdSkills.filter((s) => listed.has(s.toLowerCase()) || keywordInText(s, text)).length / jdSkills.length) * 100)
    : 0;

  const sections = [cv.summary, cv.experience.length, cv.education.length, allSkills(cv).length];
  const sectionCompleteness = (sections.filter(Boolean).length / sections.length) * 100;

  const { missing, injectable } = keywordGaps(jk, text, masterText);
  const sub = { keywordMatch: round(keywordMatch), skillsCoverage: round(skillsCoverage), sectionCompleteness: round(sectionCompleteness), missing: missing.slice(0, 10), injectable: injectable.slice(0, 10) };
  return {
    ...sub,
    overall: round(keywordMatch * WEIGHTS.keywordMatch + skillsCoverage * WEIGHTS.skillsCoverage + sectionCompleteness * WEIGHTS.sectionCompleteness),
    keywords,
    recommendations: recommendations(sub),
  };
}

export function keywordsForPrompt(jk: JobKeywords) {
  const sections: string[] = [];
  if (jk.requiredSkills.length) sections.push(`Required skills to emphasize:\n- ${jk.requiredSkills.join("\n- ")}`);
  if (jk.preferredSkills.length) sections.push(`Preferred skills (include only if resume supports them):\n- ${jk.preferredSkills.join("\n- ")}`);
  if (jk.keywords.length) sections.push(`Additional keywords to weave in naturally:\n- ${jk.keywords.join("\n- ")}`);
  return sections.join("\n\n") || "No specific keywords extracted.";
}
