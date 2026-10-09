import { describe, expect, it } from "vitest";
import { calibrate, estimatePct, usedPct } from "~/lib/run-cost";
import { wordDiff } from "~/lib/word-diff";
import { cleanResearch, researchRequest } from "~/server/cv/research";
import { applyEdits } from "~/server/cv/tailored";
import { atsScore, cleanJobKeywords, contentText, keywordGaps, keywordInText } from "~/server/cv/tailoring/keywords";
import { cleanState, continueTailoring, startTailoring, type TailorContext } from "~/server/cv/tailoring/pipeline";
import { verifyEmphasis } from "~/server/cv/tailoring/emphasis";
import { confirmedForPrompt, gapsRequest, skillGaps, sortGaps, withAnswers } from "~/server/cv/tailoring/questions";
import { alignWithMaster, removeAiPhrases, verifySkillPlan } from "~/server/cv/tailoring/refine";
import { applyDiffs, chooseProjects, resumeView, verifyDiffResult } from "~/server/cv/tailoring/resume";
import { typstCv } from "~/lib/cv";
import type { CvContent, ResumeChange, SkillTarget } from "~/types/cv";

const CV: CvContent = {
  summary: "Backend developer who builds reliable APIs.",
  experience: [
    {
      id: "acme",
      company: "Acme",
      title: "Platform Engineer",
      location: "Bristol",
      url: "acme.co.uk",
      start: "Mar 2023",
      end: null,
      bullets: [
        { id: "b1", text: "Built REST APIs in Go for the billing service" },
        { id: "b2", text: "Cut deploy time by 40% with a new CI pipeline" },
      ],
    },
  ],
  projects: [{ id: "p1", name: "Plant Diary", url: "plantdiary.app", subtitle: "", details: "Go, SQLite", bullets: [{ id: "b3", text: "Built a watering tracker" }] }],
  education: [{ id: "e1", institution: "University of Leeds", qualification: "BSc Computer Science", location: "", start: "2016", end: "2019", details: ["Final project on routing"] }],
  skills: [{ id: "g1", label: "Technical Skills", items: ["Go", "SQL", "Docker"] }],
  certifications: [],
};

const JOB = "We need a backend engineer with Go, Kubernetes and PostgreSQL experience to build REST APIs.";
const KEYWORDS = cleanJobKeywords({
  company: "Beta",
  role: "Backend Engineer",
  required_skills: ["Go", "Kubernetes"],
  preferred_skills: ["PostgreSQL"],
  keywords: ["REST APIs", "billing"],
});

const PERSON = { name: "Sam Example", phone: "", location: "", email: "", linkedin: "", github: "", website: "" };
const change = (over: Partial<ResumeChange>): ResumeChange => ({ path: "summary", action: "replace", original: CV.summary, value: "New", reason: "", ...over });
const TARGETS: SkillTarget[] = [{ skill: "Kubernetes", source: "jd_added", reason: "" }];

describe("applyDiffs", () => {
  it("applies a replace only when the original text matches", () => {
    const { result, applied, rejected } = applyDiffs(CV, [
      change({ path: "experience[0].bullets[0]" }),
      change({ path: "workExperience[0].description[0]", original: "not the bullet" }),
      change({ path: "workExperience[0].description[0]", original: "built rest apis in go for the billing service", value: "Built REST APIs in Go for billing" }),
    ], [], false);
    expect(applied).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(result.experience[0].bullets[0]).toEqual({ id: "b1", text: "Built REST APIs in Go for billing" });
    expect(CV.experience[0].bullets[0].text).toBe("Built REST APIs in Go for the billing service");
  });

  it("only appends bullets under the full strategy", () => {
    const append = change({ path: "workExperience[0].description", action: "append", original: null, value: "Mentored two engineers" });
    expect(applyDiffs(CV, [append], [], false).applied).toHaveLength(0);
    expect(applyDiffs(CV, [append], [], true).result.experience[0].bullets).toHaveLength(3);
  });

  it("adds skills only from verified targets and keeps every original in a reorder", () => {
    const { result, applied } = applyDiffs(CV, [
      change({ path: "skills[0].items", action: "add_skill", original: null, value: "Kubernetes" }),
      change({ path: "skills[0].items", action: "add_skill", original: null, value: "Rust" }),
      change({ path: "skills[0].items", action: "reorder", original: null, value: ["SQL", "Go", "Terraform"] }),
    ], TARGETS, false);
    expect(applied).toHaveLength(2);
    expect(result.skills[0].items).toEqual(["SQL", "Go", "Docker", "Kubernetes"]);
    const bullets = change({ path: "workExperience[0].description", action: "reorder", original: null, value: ["b"] });
    expect(applyDiffs(CV, [bullets], [], true).rejected).toHaveLength(1);
  });
});

describe("verifyDiffResult", () => {
  it("warns about metrics the original didn't have", () => {
    const edit = change({ path: "workExperience[0].description[0]", original: CV.experience[0].bullets[0].text, value: "Built APIs serving 90% of traffic at 99.9% uptime" });
    const { result, applied } = applyDiffs(CV, [edit], [], false);
    expect(verifyDiffResult(CV, result, applied, contentText(CV))[0]).toBe("Possible invented number in Acme, bullet 1: 90%, 99.9% (not in the original).");
  });

  it("flags job terms an edit adds that the CV doesn't back", () => {
    const edit = change({ path: "workExperience[0].description[0]", original: CV.experience[0].bullets[0].text, value: "Built REST APIs in Go as microservices for the billing service" });
    const { result, applied } = applyDiffs(CV, [edit], [], false);
    expect(verifyDiffResult(CV, result, applied, contentText(CV), ["microservices", "Go"])).toEqual(["Not backed by your CV or answers, in Acme, bullet 1: microservices."]);
  });

  it("accepts a number that appears elsewhere in the CV", () => {
    const edit = change({ path: "summary", value: "Backend developer who cut deploy time by 40%." });
    const { result, applied } = applyDiffs(CV, [edit], [], false);
    expect(verifyDiffResult(CV, result, applied, contentText(CV))).toEqual([]);
  });
});

describe("reserve projects", () => {
  const reserve = { id: "p2", name: "Edge Tracker", url: "", subtitle: "", details: "Cloudflare Workers, D1", bullets: [{ id: "b9", text: "Open-source app on Cloudflare Workers" }], optional: true };
  const withReserve: CvContent = { ...CV, projects: [...CV.projects, reserve] };

  it("are left off the master CV render", () => {
    expect(typstCv(PERSON, withReserve).projects.map((p) => p.name)).toEqual(["Plant Diary"]);
  });

  it("can be chosen by the skill plan, ignoring indices that don't exist", () => {
    expect(chooseProjects({}, withReserve)).toEqual([0]);
    expect(chooseProjects({ projects: [1, 7, 1, -1] }, withReserve)).toEqual([1]);
  });

  it("join the tailored CV when chosen and count as evidence", () => {
    const ctx: TailorContext = { master: withReserve, jobDescription: JOB, keywords: KEYWORDS, research: null, confirmed: [] };
    const plan = startTailoring(ctx, "keywords");
    if (!("request" in plan)) throw new Error("expected a request");
    expect(plan.request.input).toContain('"optional":true');
    const diffs = continueTailoring(ctx, "plan", { target_skills: [], projects: [1, 0] }, plan.state);
    if (!("request" in diffs)) throw new Error("expected a request");
    const view = JSON.parse(diffs.request.input.split("Original Resume:\n")[1].split("\n\nOutput")[0]);
    expect(view.personalProjects.map((p: { name: string }) => p.name)).toEqual(["Edge Tracker", "Plant Diary"]);
    const summary = change({ path: "personalProjects[0].description[0]", original: reserve.bullets[0].text, value: "Open-source Go service on Cloudflare Workers" });
    const next = continueTailoring(ctx, "diffs", { changes: [summary] }, cleanState(JSON.parse(JSON.stringify(diffs.state))));
    if (!("request" in next)) throw new Error("expected a request");
    expect(next.state.tailored!.projects.map((p) => [p.name, p.optional])).toEqual([["Edge Tracker", undefined], ["Plant Diary", undefined]]);
    expect(next.state.edits).toHaveLength(1);
  });
});

describe("keywordInText", () => {
  it("treats hyphens, spaces and joined words as the same", () => {
    expect(keywordInText("full-stack", "Full Stack Software Engineer")).toBe(true);
    expect(keywordInText("Full Stack", "a full-stack role")).toBe(true);
    expect(keywordInText("full stack", "Fullstack developer")).toBe(true);
    expect(keywordInText("C++", "Wrote C++ services")).toBe(true);
    expect(keywordInText("Go", "Google")).toBe(false);
    expect(keywordInText("microservices", "unified microservice-based pipelines")).toBe(true);
    expect(keywordInText("REST API", "Built REST APIs")).toBe(true);
    expect(keywordInText("AWS", "Used AW tooling")).toBe(false);
  });
});

describe("questions", () => {
  it("asks only about job terms the CV doesn't show and that weren't answered", () => {
    const answered = [{ term: "postgresql", has: false, detail: "" }];
    expect(skillGaps(KEYWORDS, CV, answered)).toEqual([{ term: "Kubernetes", kind: "required" }]);
  });

  it("lists only skill gaps, never twice for the same term", () => {
    const many = cleanJobKeywords({
      required_skills: ["Rust", "Elixir", "full-stack", "Haskell"],
      preferred_skills: ["OCaml", "rust", "Zig", "Lua", "Perl"],
      keywords: ["Norwich", "startup"],
      soft_skills: ["empathy"],
    });
    const cv = { ...CV, experience: [{ ...CV.experience[0], title: "Full Stack Software Engineer" }] };
    expect(skillGaps(many, cv, []).map((q) => q.term)).toEqual(["Rust", "Elixir", "Haskell", "OCaml", "Zig", "Lua", "Perl"]);
  });

  it("assumes what Claude judges implied and asks about at most six of the rest", () => {
    const gaps = ["Frontend", "Coding", "Rust", "Elixir", "Haskell", "OCaml", "Zig", "Lua", "Perl"].map((term) => ({ term, kind: "required" as const }));
    const sorted = sortGaps({ implied: ["frontend", "coding", "Cobol"], ask: ["Rust", "frontend", "Elixir", "Haskell", "OCaml", "Zig", "Lua", "Perl"] }, gaps);
    expect(sorted.implied).toEqual([
      { term: "Frontend", has: true, detail: "Assumed from your CV" },
      { term: "Coding", has: true, detail: "Assumed from your CV" },
    ]);
    expect(sorted.ask.map((q) => q.term)).toEqual(["Rust", "Elixir", "Haskell", "OCaml", "Zig", "Lua"]);
    expect(gapsRequest(gaps.slice(0, 2), CV)).toMatchObject({ effort: "low" });
  });

  it("keeps the latest answer for a term", () => {
    const saved = [{ term: "Kubernetes", has: false, detail: "" }];
    expect(withAnswers(saved, [{ term: "kubernetes", has: true, detail: "Ran clusters at Acme" }])).toEqual([{ term: "kubernetes", has: true, detail: "Ran clusters at Acme" }]);
  });

  it("treats a yes as evidence for skills and gives it to the prompts", () => {
    const confirmed = [{ term: "Kubernetes", has: true, detail: "Ran clusters at Acme" }, { term: "PostgreSQL", has: false, detail: "" }];
    const ctx: TailorContext = { master: CV, jobDescription: "Kubernetes and Terraform", keywords: KEYWORDS, research: null, confirmed };
    const plan = startTailoring(ctx, "keywords");
    if (!("request" in plan)) throw new Error("expected a request");
    expect(plan.request.input).toContain("- Kubernetes: Ran clusters at Acme");
    expect(plan.request.input.split("Confirmed by the candidate")[1].split("Resume JSON")[0]).not.toContain("PostgreSQL");
    expect(confirmedForPrompt([{ term: "C++", has: false, detail: "I write Rust daily" }])).toContain("never claim them. The note may point to related experience they do have:\n- C++: I write Rust daily");
    const diffs = continueTailoring(ctx, "plan", { target_skills: [{ skill: "Kubernetes" }, { skill: "PostgreSQL" }] }, plan.state);
    if (!("request" in diffs)) throw new Error("expected a request");
    expect(diffs.state.targets.map((t) => t.skill)).toEqual(["Kubernetes"]);
  });
});

describe("refining", () => {
  it("accepts skill targets only when the CV backs them, even ones the job asks for", () => {
    const plan = verifySkillPlan({ target_skills: [{ skill: "go" }, { skill: "Kubernetes" }, { skill: "billing" }, { skill: "Cobol" }] }, CV, KEYWORDS, JOB);
    expect(plan.accepted.map((t) => [t.skill, t.source])).toEqual([
      ["Go", "existing"],
      ["billing", "supported_by_resume"],
    ]);
    expect(plan.rejected).toEqual(["Kubernetes", "Cobol"]);
  });

  it("replaces AI-sounding phrases unless the job uses them", () => {
    const cv = { ...CV, summary: "Spearheaded robust APIs in order to scale unscalable systems" };
    expect(removeAiPhrases(cv, JOB).cv.summary).toBe("Led strong APIs to scale unscalable systems");
    expect(removeAiPhrases(cv, "We want robust systems").cv.summary).toBe("Led robust APIs to scale unscalable systems");
  });

  it("removes skills the CV and answers don't back, even ones the job asks for", () => {
    const cv = { ...CV, skills: [{ id: "g1", label: "Technical Skills", items: ["Go", "Kubernetes", "Cobol"] }] };
    expect(alignWithMaster(cv, CV)).toMatchObject({ removed: ["Kubernetes", "Cobol"], cv: { skills: [{ items: ["Go"] }] } });
    expect(alignWithMaster(cv, CV, `${contentText(CV)}\nKubernetes`).removed).toEqual(["Cobol"]);
  });
});

describe("verifyEmphasis", () => {
  it("keeps short phrases copied exactly from their line and drops the rest", () => {
    const emphasis = verifyEmphasis(CV, {
      emphasis: [
        { path: "workExperience[0].description[1]", phrases: ["deploy time by 40%", "cut deploy time", "Cut deploy time by 40% with a new CI pipeline", "CI pipeline"] },
        { path: "summary", phrases: ["reliable APIs"] },
        { path: "education[0].description[0]", phrases: ["Final project"] },
        { path: "workExperience[9].description[0]", phrases: ["Go"] },
      ],
    });
    expect(emphasis).toEqual({ "workExperience[0].description[1]": ["deploy time by 40%", "CI pipeline"], summary: ["reliable APIs"] });
  });
});

describe("atsScore", () => {
  it("weights keyword match, skills coverage and sections 55/25/20", () => {
    const score = atsScore(CV, KEYWORDS, contentText(CV));
    expect(score.keywordMatch).toBe(60);
    expect(score.skillsCoverage).toBe(33.3);
    expect(score.sectionCompleteness).toBe(100);
    expect(score.overall).toBe(61.3);
    expect(score.missing).toEqual(["Kubernetes", "PostgreSQL"]);
    expect(keywordGaps(KEYWORDS, "", contentText(CV)).injectable).toEqual(["Go", "REST APIs", "billing"]);
  });
});

describe("pipeline", () => {
  it("runs keywords, plan, diffs, keyword injection and cover letter into a scored tailored CV", () => {
    const ctx: TailorContext = { master: CV, jobDescription: JOB, keywords: null, research: null, confirmed: [] };
    const first = startTailoring(ctx, "keywords");
    expect(first).toMatchObject({ stage: "keywords", request: { provider: "antigravity" } });

    const extracted = continueTailoring(ctx, "keywords", { required_skills: ["Go", "Kubernetes", "billing"], keywords: ["SQL", "reliable"] }, cleanState({}));
    if (!("keywords" in extracted)) throw new Error("expected keywords");
    const withKeywords = { ...ctx, keywords: extracted.keywords };

    const plan = startTailoring(withKeywords, "keywords");
    if (!("request" in plan)) throw new Error("expected a request");
    expect(plan.stage).toBe("plan");
    expect(plan.request.provider).toBe("claude");

    const diffs = continueTailoring(withKeywords, "plan", { target_skills: [{ skill: "Kubernetes", reason: "required" }, { skill: "Go", reason: "required" }] }, plan.state);
    if (!("request" in diffs)) throw new Error("expected a request");
    expect(diffs.request.input).toContain("- Go (existing): required");
    expect(diffs.request.input).not.toContain("- Kubernetes (");

    const bullet = CV.experience[0].bullets[0].text;
    const reply = { changes: [change({ path: "workExperience[0].description[0]", original: bullet, value: "Built REST APIs in Go" })], missing_outcomes: ["Built a watering tracker"], strategy_notes: "Led with Go" };
    const inject = continueTailoring(withKeywords, "diffs", reply, cleanState(JSON.parse(JSON.stringify(diffs.state))));
    if (!("request" in inject)) throw new Error("expected a request");
    expect(inject.stage).toBe("inject");
    expect(JSON.parse(inject.request.input.split("Keywords to inject (only if supported by master resume):\n")[1].split("\n")[0])).toEqual(["billing"]);

    const injected = { ...resumeView(inject.state.tailored!), summary: "Backend engineer who builds reliable Go APIs on Kubernetes for billing." };
    const emphasis = continueTailoring(withKeywords, "inject", injected, cleanState(JSON.parse(JSON.stringify(inject.state))));
    if (!("request" in emphasis)) throw new Error("expected a request");
    expect(emphasis.stage).toBe("emphasis");
    expect(emphasis.request.input).toContain("workExperience[0].description[1]: Cut deploy time by 40% with a new CI pipeline");

    const bold = { emphasis: [{ path: "workExperience[0].description[1]", phrases: ["Cut deploy time by 40%"] }] };
    const letter = continueTailoring(withKeywords, "emphasis", bold, cleanState(JSON.parse(JSON.stringify(emphasis.state))));
    if (!("request" in letter)) throw new Error("expected a request");
    expect(letter.stage).toBe("letter");

    const done = continueTailoring(withKeywords, "letter", { greeting: "Dear team,", paragraphs: ["I build Go APIs."], signOff: "Kind regards," }, letter.state);
    if (!("done" in done)) throw new Error("expected done");
    expect(done.done.summary).toContain("billing");
    expect(done.done.edits).toEqual([
      expect.objectContaining({ path: "workExperience[0].description[0]", original: bullet, value: "Built REST APIs in Go" }),
      expect.objectContaining({ path: "summary", original: CV.summary, value: "Backend engineer who builds reliable Go APIs on Kubernetes for billing." }),
    ]);
    expect(done.done.coverLetter.paragraphs).toEqual(["I build Go APIs."]);
    expect(done.done.score!.after.keywordMatch).toBeGreaterThan(done.done.score!.before.keywordMatch);
    expect(done.done).not.toHaveProperty("summaries");
    expect(done.done.flags).toContain('Add the result to this line on your CV: "Built a watering tracker"');
    expect(done.done.experience[0].bullets[1].bold).toEqual(["Cut deploy time by 40%"]);
    expect(done.done.experience[0]).toMatchObject({ company: "Acme", title: "Platform Engineer", start: "Mar 2023" });
  });
});

describe("applyEdits", () => {
  it("keeps the entries left in the editor and bold that is still in its line", () => {
    const second = { ...CV.experience[0], id: "beta", company: "Beta" };
    const previous = { ...CV, experience: [CV.experience[0], second], coverLetter: { greeting: "", paragraphs: [], signOff: "" }, changes: [], flags: [] };
    const edited = {
      ...previous,
      summaryBold: ["reliable APIs", "not in the summary"],
      experience: [{ ...second, bullets: [{ id: "x1", text: "Cut deploy time by 40%", bold: ["40%", "Cut", "deploy", "time", "by"] }] }],
      projects: [{ id: "unknown", bullets: [] }],
    };
    const saved = applyEdits(previous, edited);
    expect(saved.summaryBold).toEqual(["reliable APIs"]);
    expect(saved.experience.map((e) => e.company)).toEqual(["Beta"]);
    expect(saved.experience[0].bullets[0].bold).toEqual(["40%", "Cut", "deploy", "time"]);
    expect(saved.projects).toEqual([]);
    expect(applyEdits(previous, { summary: "Hi" }).experience).toHaveLength(2);
  });
});

describe("company research", () => {
  it("is given to the skill plan and the edits, with a rule against copying it", () => {
    const research = { summary: "", values: ["Ship small, ship often"], lookingFor: ["Owners"], culture: [], news: [], sources: [], researchedAt: "" };
    const ctx: TailorContext = { master: CV, jobDescription: JOB, keywords: KEYWORDS, research, confirmed: [] };
    const plan = startTailoring(ctx, "keywords");
    if (!("request" in plan)) throw new Error("expected a request");
    expect(plan.request.input).toContain("Ship small, ship often");
    const diffs = continueTailoring(ctx, "plan", { target_skills: [] }, plan.state);
    if (!("request" in diffs)) throw new Error("expected a request");
    expect(diffs.request.input).toContain("Ship small, ship often");
    expect(diffs.request.input).toContain("Never copy its wording");
  });

  it("asks for web tools and keeps only safe links from the reply", () => {
    expect(researchRequest({ company: "Acme", role: "PM", description: "Build things", url: "" })).toMatchObject({ web: true, effort: "medium", provider: "antigravity" });
    const research = cleanResearch({
      values: ["Ship fast", "Ship fast", 3],
      sources: [
        { title: "About", url: "https://acme.example/about" },
        { title: "Bad", url: "javascript:alert(1)" },
      ],
    });
    expect(research.values).toEqual(["Ship fast"]);
    expect(research.sources).toEqual([{ title: "About", url: "https://acme.example/about" }]);
  });
});

describe("run cost", () => {
  const stage = (costUsd: number) => ({ costUsd, inputTokens: 0, cachedTokens: 0, outputTokens: 0 });

  it("learns how many percent of each limit a dollar takes from readings before and after a run", () => {
    const run = { stages: [stage(1), stage(2)], before: { fiveHour: 28, sevenDay: 76 }, after: { fiveHour: 31, sevenDay: 77 } };
    expect(usedPct(run, "fiveHour")).toBe(3);
    const calibration = calibrate(undefined, run, "tailor");
    expect(calibration.fiveHour).toEqual({ pct: 3, usd: 3 });
    expect(calibration.lastCost).toEqual({ tailor: 3 });
    expect(estimatePct(calibration, "fiveHour", 2)).toBe(2);
    expect(estimatePct(calibration, "sevenDay", 6)).toBe(2);
  });

  it("ignores a run whose window reset or that has no readings", () => {
    const reset = calibrate(undefined, { stages: [stage(1)], before: { fiveHour: 90, sevenDay: 70 }, after: { fiveHour: 2, sevenDay: 71 } }, "tailor");
    expect(reset.fiveHour).toEqual({ pct: 0, usd: 0 });
    expect(reset.sevenDay).toEqual({ pct: 1, usd: 1 });
    expect(estimatePct(calibrate(undefined, { stages: [stage(1)], before: null, after: null }, "research"), "fiveHour", 1)).toBeNull();
  });
});

describe("wordDiff", () => {
  it("marks removed and added words around the unchanged ones", () => {
    expect(wordDiff("Built REST APIs for the billing service", "Built REST APIs in Go for billing")).toEqual([
      { kind: "same", text: "Built REST APIs" },
      { kind: "added", text: "in Go" },
      { kind: "same", text: "for" },
      { kind: "removed", text: "the" },
      { kind: "same", text: "billing" },
      { kind: "removed", text: "service" },
    ]);
  });
});
