import type { CompanyResearch, Confirmation, CvContent, JobKeywords, ResumeChange, SkillTarget, TailoredCv, TailorRequest } from "~/types/cv";
import { cleanCv, list, obj, str, strings } from "../clean";
import { coverLetterFrom } from "../tailored";
import { applyEmphasis, cleanEmphasis, EMPHASIS_PROMPT, type Emphasis, emphasisSlots, verifyEmphasis } from "./emphasis";
import { allKeywords, atsScore, cleanJobKeywords, contentText, keywordGaps, keywordsForPrompt } from "./keywords";
import {
  COVER_LETTER_PROMPT,
  DIFF_IMPROVE_PROMPT,
  DIFF_STRATEGY_INSTRUCTIONS,
  EXTRACT_KEYWORDS_PROMPT,
  fill,
  KEYWORD_INJECTION_PROMPT,
  SKILL_TARGET_PLAN_PROMPT,
  STRATEGIES,
  SYSTEM_PROMPTS,
  type Strategy,
} from "./prompts";
import { confirmedForPrompt, evidenceText, scoreBefore } from "./questions";
import { alignWithMaster, MAX_NOTE_CHARS, mergeInjected, removeAiPhrases, verifySkillPlan, withInjectedEdits } from "./refine";
import { applyDiffs, chooseProjects, resumeView, verifyDiffResult, withProjects } from "./resume";
import { DIFFS_SCHEMA, EMPHASIS_SCHEMA, INJECT_SCHEMA, KEYWORDS_SCHEMA, LETTER_SCHEMA, PLAN_SCHEMA } from "./schemas";

export type Stage = "keywords" | "plan" | "diffs" | "inject" | "emphasis" | "letter";

export interface TailorState {
  strategy: Strategy;
  targets: SkillTarget[];
  tailored: CvContent | null;
  edits: ResumeChange[];
  rejected: number;
  warnings: string[];
  notes: string[];
  emphasis: Emphasis;
  projects: number[];
}

export interface TailorContext {
  master: CvContent;
  jobDescription: string;
  keywords: JobKeywords | null;
  research: CompanyResearch | null;
  confirmed: Confirmation[];
}

export type Step = { stage: Stage; request: TailorRequest; state: TailorState } | { keywords: JobKeywords } | { done: TailoredCv };

const MAX_JOB_CHARS = 12_000;
const INJECTION = /ignore\s+(all\s+)?previous\s+instructions|disregard\s+(all\s+)?above|forget\s+(everything|all)|new\s+instructions?:|system\s*:|<\s*\/?\s*system\s*>|\[\s*\/?\s*INST\s*\]/gi;

const sanitise = (text: string) => text.slice(0, MAX_JOB_CHARS).replace(INJECTION, "[REDACTED]");
const json = (value: unknown) => JSON.stringify(value);

const EFFORT: Record<Stage, TailorRequest["effort"]> = {
  keywords: "low",
  plan: "medium",
  diffs: "high",
  inject: "medium",
  emphasis: "low",
  letter: "medium",
};

function request(stage: Stage, prompt: string, schema: object): TailorRequest {
  const provider = stage === "keywords" ? "antigravity" : "claude";
  return { system: SYSTEM_PROMPTS[stage], schema, input: prompt, effort: EFFORT[stage], provider };
}

const evidence = (ctx: TailorContext) => evidenceText(ctx.master, ctx.confirmed);

function researchFor(ctx: TailorContext) {
  const r = ctx.research;
  return r ? json({ values: r.values, lookingFor: r.lookingFor, news: r.news }) : "Nothing found.";
}

function keywordsRequest(ctx: TailorContext) {
  return request("keywords", fill(EXTRACT_KEYWORDS_PROMPT, { job_description: sanitise(ctx.jobDescription) }), KEYWORDS_SCHEMA);
}

function planRequest(ctx: TailorContext, jk: JobKeywords) {
  return request(
    "plan",
    fill(SKILL_TARGET_PLAN_PROMPT, {
      existing_skills: ctx.master.skills.flatMap((g) => g.items).join(", ") || "None",
      job_keywords: keywordsForPrompt(jk),
      job_description: sanitise(ctx.jobDescription),
      company_research: researchFor(ctx),
      confirmed: confirmedForPrompt(ctx.confirmed),
      original_resume: json(resumeView(ctx.master)),
    }),
    PLAN_SCHEMA,
  );
}

const base = (ctx: TailorContext, state: TailorState) => withProjects(ctx.master, state.projects);

function diffsRequest(ctx: TailorContext, jk: JobKeywords, state: TailorState) {
  const targets = state.targets.map((t) => `- ${t.skill} (${t.source}): ${t.reason}`).join("\n") || "No verified skill targets.";
  return request(
    "diffs",
    fill(DIFF_IMPROVE_PROMPT, {
      strategy_instruction: DIFF_STRATEGY_INSTRUCTIONS[state.strategy],
      job_keywords: keywordsForPrompt(jk),
      skill_targets: targets,
      job_description: sanitise(ctx.jobDescription),
      company_research: researchFor(ctx),
      confirmed: confirmedForPrompt(ctx.confirmed),
      original_resume: json(resumeView(base(ctx, state))),
    }),
    DIFFS_SCHEMA,
  );
}

function emphasisStep(jk: JobKeywords, state: TailorState): Step {
  const lines = emphasisSlots(state.tailored!).map(([path, text]) => `${path}: ${text}`).join("\n");
  return { stage: "emphasis", request: request("emphasis", fill(EMPHASIS_PROMPT, { job_keywords: keywordsForPrompt(jk), lines }), EMPHASIS_SCHEMA), state };
}

function letterRequest(ctx: TailorContext, tailored: CvContent) {
  return request(
    "letter",
    fill(COVER_LETTER_PROMPT, {
      job_description: sanitise(ctx.jobDescription),
      resume_data: json(resumeView(tailored)),
      company_research: researchFor(ctx),
    }),
    LETTER_SCHEMA,
  );
}

function polished(ctx: TailorContext, state: TailorState, cv: CvContent): TailorState {
  const { cv: cleaned, removed: phrases } = removeAiPhrases(cv, ctx.jobDescription);
  const { cv: aligned, removed } = alignWithMaster(cleaned, ctx.master, evidence(ctx));
  const warnings = [...state.warnings];
  if (phrases.length) warnings.push(`Replaced AI-sounding phrases: ${phrases.join(", ")}.`);
  if (removed.length) warnings.push(`Removed skills or certifications not backed by your CV or your answers: ${removed.join(", ")}.`);
  return { ...state, tailored: aligned, warnings };
}

export function startTailoring(ctx: TailorContext, strategy: Strategy): Step {
  const projects = chooseProjects({}, ctx.master);
  const state: TailorState = { strategy, targets: [], tailored: null, edits: [], rejected: 0, warnings: [], notes: [], emphasis: {}, projects };
  if (!ctx.keywords) return { stage: "keywords", request: keywordsRequest(ctx), state };
  return { stage: "plan", request: planRequest(ctx, ctx.keywords), state };
}

export function continueTailoring(ctx: TailorContext, stage: Stage, result: unknown, state: TailorState): Step {
  if (stage === "keywords") return { keywords: cleanJobKeywords(result) };
  const jk = ctx.keywords;
  if (!jk) throw new Error("Job keywords are missing");

  if (stage === "plan") {
    const plan = verifySkillPlan(result, ctx.master, jk, ctx.jobDescription, evidence(ctx));
    const warnings = plan.rejected.length ? [...state.warnings, `${plan.rejected.length} skill target(s) not backed by your CV or your answers: ${plan.rejected.join(", ")}.`] : state.warnings;
    const next = { ...state, targets: plan.accepted, warnings, notes: plan.notes ? [plan.notes] : [], projects: chooseProjects(result, ctx.master) };
    return { stage: "diffs", request: diffsRequest(ctx, jk, next), state: next };
  }

  if (stage === "diffs") {
    const changes = cleanChanges(obj(result).changes);
    const start = base(ctx, state);
    const { result: tailored, applied, rejected } = applyDiffs(start, changes, state.targets, state.strategy === "full");
    const warnings = [...state.warnings, ...verifyDiffResult(start, tailored, applied, evidence(ctx), allKeywords(jk).map((k) => k.term))];
    if (rejected.length) warnings.push(`${rejected.length} change(s) rejected during verification.`);
    for (const line of strings(obj(result).missing_outcomes, 500)) warnings.push(`Add the result to this line on your CV: "${line}"`);
    const notes = [...state.notes, str(obj(result).strategy_notes, MAX_NOTE_CHARS)].filter(Boolean);
    const next: TailorState = { ...state, tailored, edits: applied, rejected: rejected.length, warnings, notes };
    const skills = new Set([...jk.requiredSkills, ...jk.preferredSkills]);
    const injectable = keywordGaps(jk, contentText(tailored), evidence(ctx)).injectable.filter((term) => skills.has(term));
    if (!injectable.length) {
      return emphasisStep(jk, polished(ctx, next, tailored));
    }
    const prompt = fill(KEYWORD_INJECTION_PROMPT, {
      keywords_to_inject: json(injectable),
      current_resume: json(resumeView(tailored)),
      master_resume: json({ ...resumeView(ctx.master), confirmedByCandidate: ctx.confirmed.filter((c) => c.has) }),
      job_description: sanitise(ctx.jobDescription).slice(0, 2000),
    });
    return { stage: "inject", request: request("inject", prompt, INJECT_SCHEMA), state: next };
  }

  const tailored = state.tailored ?? base(ctx, state);
  if (stage === "inject") {
    const merged = mergeInjected(tailored, result);
    return emphasisStep(jk, polished(ctx, { ...state, edits: withInjectedEdits(state.edits, base(ctx, state), tailored, merged) }, merged));
  }

  if (stage === "emphasis") {
    return { stage: "letter", request: letterRequest(ctx, tailored), state: { ...state, emphasis: verifyEmphasis(tailored, result) } };
  }

  return {
    done: {
      ...applyEmphasis(tailored, state.emphasis),
      coverLetter: coverLetterFrom(result),
      changes: state.notes,
      flags: state.warnings,
      edits: state.edits,
      rejectedEdits: state.rejected,
      score: { before: scoreBefore(ctx.master, ctx.confirmed, jk), after: atsScore(tailored, jk, evidence(ctx)) },
      strategy: state.strategy,
    },
  };
}

function cleanChanges(raw: unknown): ResumeChange[] {
  const actions = new Set(["replace", "append", "reorder", "add_skill"]);
  return list(raw)
    .map((c) => obj(c))
    .filter((c) => actions.has(String(c.action)))
    .map((c) => ({
      path: str(c.path, 120),
      action: c.action as ResumeChange["action"],
      original: typeof c.original === "string" ? c.original : null,
      value: Array.isArray(c.value) ? strings(c.value, 200) : str(c.value, 1500),
      reason: str(c.reason, 500),
    }));
}

export function cleanState(raw: unknown): TailorState {
  const r = obj(raw);
  const tailored = r.tailored ? obj(r.tailored) : null;
  const { summaries: _summaries, targetRoles: _targetRoles, confirmed: _confirmed, ...cleaned } = cleanCv({ ...tailored, summaries: [] });
  return {
    strategy: STRATEGIES.includes(r.strategy as Strategy) ? (r.strategy as Strategy) : "keywords",
    targets: list(r.targets).map((t) => ({
      skill: str(obj(t).skill, 80),
      source: (["existing", "jd_added", "supported_by_resume"].includes(String(obj(t).source)) ? obj(t).source : "existing") as SkillTarget["source"],
      reason: str(obj(t).reason, 300),
    })),
    tailored: tailored ? { ...cleaned, summary: str(tailored.summary, 1500) } : null,
    edits: cleanChanges(r.edits),
    rejected: Number(r.rejected) || 0,
    warnings: strings(r.warnings, 500),
    notes: strings(r.notes, MAX_NOTE_CHARS),
    emphasis: cleanEmphasis(r.emphasis),
    projects: list(r.projects).filter((i): i is number => Number.isInteger(i) && i >= 0),
  };
}

export const isStrategy = (value: unknown): value is Strategy => STRATEGIES.includes(value as Strategy);
