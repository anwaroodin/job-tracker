import { observable } from "@legendapp/state";
import { planUsage, runOnRunner } from "~/lib/runner";
import { recordRunCost } from "~/lib/state/run-costs";
import type { Confirmation, JobQuestion, PlanUsage, RunnerUsage, TailorRequest } from "~/types/cv";

export type TailorTarget = { applicationId: string } | { roleId: string };
export type SessionStatus = "queued" | "running" | "questions" | "done" | "failed";

export interface TailoringSession {
  id: string;
  company: string;
  role: string;
  href: string;
  target: TailorTarget;
  model: string;
  letter: boolean;
  status: SessionStatus;
  stage: string | null;
  stageStartedAt: number | null;
  durations: Record<string, number>;
  questions: JobQuestion[] | null;
  answers: Confirmation[] | null;
  error: string | null;
  createdAt: number;
}

export type NewSession = Pick<TailoringSession, "company" | "role" | "href" | "target" | "model" | "letter">;

type Step = { stage: string; request: TailorRequest; state: unknown } | { questions: JobQuestion[] } | { done: true };

export const STAGES = [
  { id: "keywords", label: "Keywords", doing: "Reading what the job asks for…" },
  { id: "gaps", label: "Coverage", doing: "Checking what your CV already covers…" },
  { id: "plan", label: "Plan", doing: "Planning which skills to target…" },
  { id: "diffs", label: "Rewrite", doing: "Rewriting your CV for the job…" },
  { id: "inject", label: "Keywords+", doing: "Working in missing keywords…" },
  { id: "emphasis", label: "Bold", doing: "Choosing what to bold for a quick skim…" },
  { id: "letter", label: "Letter", doing: "Writing the cover letter…" },
];

export const stageIndex = (id: string | null) => STAGES.findIndex((s) => s.id === id);

export const tailoring$ = observable<Record<string, TailoringSession>>({});

const usage = new Map<string, { stages: RunnerUsage[]; before: PlanUsage | null }>();

export const sessionId = (target: TailorTarget) => ("applicationId" in target ? `job:${target.applicationId}` : `role:${target.roleId}`);
export const isActive = (s: TailoringSession | undefined) => !!s && (s.status === "queued" || s.status === "running");

async function postStep(body: object): Promise<Step> {
  const res = await fetch("/api/cv/tailor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Tailoring failed (${res.status})`);
  return res.json();
}

async function run(id: string) {
  const session$ = tailoring$[id];
  const { target, model, letter, answers } = session$.peek();
  session$.assign({ status: "running", stage: null, error: null, answers: null });
  try {
    const spent = usage.get(id) ?? { stages: [], before: await planUsage() };
    usage.set(id, spent);
    let step = await postStep({ ...target, letter, ...(answers && { answered: true, answers }) });
    while (!("done" in step)) {
      if (!session$.peek()) return;
      if ("questions" in step) {
        session$.assign({ status: "questions", stage: null, questions: step.questions });
        return;
      }
      const startedAt = Date.now();
      session$.assign({ stage: step.stage, stageStartedAt: startedAt });
      const { result, usage: stageUsage } = await runOnRunner({ ...step.request, model });
      spent.stages.push(stageUsage);
      const stage = step.stage;
      step = await postStep({ ...target, letter, stage, result, state: step.state });
      if (session$.peek()) session$.durations[stage].set(Date.now() - startedAt);
    }
    usage.delete(id);
    recordRunCost(model, "tailor", { ...spent, after: await planUsage() });
    if (session$.peek()) session$.assign({ status: "done", stage: null });
  } catch (e) {
    usage.delete(id);
    if (session$.peek()) session$.assign({ status: "failed", stage: null, error: e instanceof Error ? e.message : String(e) });
  }
}

let pumping = false;

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const next = Object.values(tailoring$.peek())
        .filter((s) => s.status === "queued")
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!next) return;
      await run(next.id);
    }
  } finally {
    pumping = false;
  }
}

export function startSession(input: NewSession) {
  const id = sessionId(input.target);
  if (isActive(tailoring$[id].peek())) return;
  usage.delete(id);
  tailoring$[id].set({ ...input, id, status: "queued", stage: null, stageStartedAt: null, durations: {}, questions: null, answers: null, error: null, createdAt: Date.now() });
  pump();
}

export function answerSession(id: string, answers: Confirmation[]) {
  tailoring$[id].assign({ status: "queued", questions: null, answers, createdAt: Date.now() });
  pump();
}

export function removeSession(id: string) {
  usage.delete(id);
  tailoring$[id].delete();
}
