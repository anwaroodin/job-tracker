import { shownProjects } from "~/lib/cv";
import type { Confirmation, CvContent, JobKeywords, JobQuestion, TailorRequest } from "~/types/cv";
import { obj, strings } from "../clean";
import { allKeywords, atsScore, contentText, keywordInText, normalizeSkillKey } from "./keywords";
import { fill, GAPS_PROMPT, SYSTEM_PROMPTS } from "./prompts";
import { resumeView } from "./resume";
import { GAPS_SCHEMA } from "./schemas";

const MAX_QUESTIONS = 6;

const confirmedYes = (confirmed: Confirmation[]) => confirmed.filter((c) => c.has);

export function evidenceText(cv: CvContent, confirmed: Confirmation[]) {
  return [contentText(cv), ...confirmedYes(confirmed).map((c) => `${c.term}\n${c.detail}`)].join("\n");
}

export const ASSUMED = "Assumed from your CV";

export function skillGaps(jk: JobKeywords, cv: CvContent, confirmed: Confirmation[]): JobQuestion[] {
  const answered = new Set(confirmed.map((c) => normalizeSkillKey(c.term)));
  const text = contentText(cv);
  return allKeywords(jk)
    .filter((k) => k.kind !== "keyword" && !answered.has(normalizeSkillKey(k.term)) && !keywordInText(k.term, text))
    .map(({ term, kind }) => ({ term, kind }));
}

export function gapsRequest(gaps: JobQuestion[], cv: CvContent): TailorRequest {
  const skills = gaps.map((g) => `- ${g.term} (${g.kind})`).join("\n");
  return { system: SYSTEM_PROMPTS.gaps, schema: GAPS_SCHEMA, input: fill(GAPS_PROMPT, { skills, resume: JSON.stringify(resumeView(cv)) }), effort: "low", provider: "antigravity" };
}

export function sortGaps(raw: unknown, gaps: JobQuestion[]) {
  const byKey = new Map(gaps.map((g) => [normalizeSkillKey(g.term), g]));
  const pick = (value: unknown) =>
    [...new Set(strings(value, 80).map(normalizeSkillKey))].flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : []));
  const implied = pick(obj(raw).implied);
  const ask = pick(obj(raw).ask).filter((g) => !implied.includes(g)).slice(0, MAX_QUESTIONS);
  return { implied: implied.map((g): Confirmation => ({ term: g.term, has: true, detail: ASSUMED })), ask };
}

export function withAnswers(confirmed: Confirmation[], answers: Confirmation[]) {
  const byTerm = new Map(confirmed.map((c) => [normalizeSkillKey(c.term), c]));
  for (const answer of answers) byTerm.set(normalizeSkillKey(answer.term), answer);
  return [...byTerm.values()];
}

const line = (c: Confirmation) => `- ${c.term}${c.detail ? `: ${c.detail}` : ""}`;

export function confirmedForPrompt(confirmed: Confirmation[]) {
  const yes = confirmedYes(confirmed);
  const noWithNote = confirmed.filter((c) => !c.has && c.detail);
  const notes = noWithNote.length
    ? `\n\nThe candidate said no to these, so never claim them. The note may point to related experience they do have:\n${noWithNote.map(line).join("\n")}`
    : "";
  return `${yes.length ? yes.map(line).join("\n") : "None."}${notes}`;
}

export function scoreBefore(master: CvContent, confirmed: Confirmation[], jk: JobKeywords) {
  return atsScore({ ...master, projects: shownProjects(master) }, jk, evidenceText(master, confirmed));
}
