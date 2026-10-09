import { useEffect, useRef, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Button } from "~/components/ui/button";
import { planUsage, runnerAvailable, runOnRunner } from "~/lib/runner";
import type { Confirmation, JobQuestion, PlanUsage, RunnerUsage, TailorRequest } from "~/types/cv";
import { JobQuestions } from "./questions";
import { RunCost, useRunCosts } from "./run-cost";

const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];
const STRATEGIES = [
  { id: "keywords", label: "Keywords: rephrase to weave in the job's keywords" },
  { id: "nudge", label: "Nudge: minimal edits where there's a clear match" },
  { id: "full", label: "Full: rephrase, add verified skills and bullets" },
];
const STAGE_LABELS: Record<string, string> = {
  keywords: "Reading what the job asks for…",
  gaps: "Checking what your CV already covers…",
  plan: "Planning which skills to target…",
  diffs: "Rewriting your CV for the job…",
  inject: "Working in missing keywords…",
  emphasis: "Choosing what to bold for a quick skim…",
  letter: "Writing the cover letter…",
};
const MODEL_KEY = "job-tracker/claude-model";

type Step = { stage: string; request: TailorRequest; state: unknown } | { questions: JobQuestion[] } | { done: true };

function useModel() {
  const [model, setModel] = useState(MODELS[0].id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODEL_KEY);
      if (saved && MODELS.some((m) => m.id === saved)) setModel(saved);
    } catch {}
  }, []);
  const choose = (id: string) => {
    setModel(id);
    try {
      localStorage.setItem(MODEL_KEY, id);
    } catch {}
  };
  return [model, choose] as const;
}

async function postStep(body: object): Promise<Step> {
  const res = await fetch("/api/cv/tailor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Tailoring failed (${res.status})`);
  return res.json();
}

export function TailorPanel({
  target,
  research,
  hasResearch,
  retailor,
}: {
  target: { applicationId: string } | { roleId: string };
  research: TailorRequest | null;
  hasResearch: boolean;
  retailor: boolean;
}) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [runner, setRunner] = useState<"checking" | "ready" | "offline">("checking");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useModel();
  const [strategy, setStrategy] = useState("keywords");
  const costs = useRunCosts();
  const [now, setNow] = useState<PlanUsage | null>(null);
  const [questions, setQuestions] = useState<JobQuestion[] | null>(null);
  const paused = useRef<{ stages: RunnerUsage[]; before: PlanUsage | null } | null>(null);

  useEffect(() => {
    runnerAvailable().then((ok) => {
      setRunner(ok ? "ready" : "offline");
      if (ok) planUsage().then(setNow);
    });
  }, []);

  const guard = async (job: () => Promise<void>) => {
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const tailor = (answers?: Confirmation[]) =>
    guard(async () => {
      const run = paused.current ?? { stages: [] as RunnerUsage[], before: await planUsage() };
      paused.current = null;
      let step = await postStep({ ...target, strategy, ...(answers && { answered: true, answers }) });
      while (!("done" in step)) {
        if ("questions" in step) {
          paused.current = run;
          setQuestions(step.questions);
          return;
        }
        setProgress(STAGE_LABELS[step.stage] ?? "Working…");
        const { result, usage } = await runOnRunner({ ...step.request, model });
        run.stages.push(usage);
        step = await postStep({ ...target, stage: step.stage, result, state: step.state });
      }
      const after = await planUsage();
      setNow(after);
      costs.record(model, "tailor", { stages: run.stages, before: run.before, after });
      revalidator.revalidate();
    });

  const answer = (answers: Confirmation[]) => {
    setQuestions(null);
    tailor(answers);
  };

  const runResearch = () =>
    guard(async () => {
      if (!research) return;
      setProgress("Searching the web for the company's values and what it looks for…");
      const before = await planUsage();
      const { result, usage } = await runOnRunner({ model, ...research });
      const after = await planUsage();
      setNow(after);
      costs.record(research.model ?? model, "research", { stages: [usage], before, after });
      fetcher.submit({ intent: "research", result: JSON.stringify(result) }, { method: "post" });
    });

  const busy = progress !== null || fetcher.state !== "idle";
  const blocked = busy || runner !== "ready" || questions !== null;
  const select = "h-8 border border-stroke-primary bg-bg-primary px-2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-secondary";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <select value={model} onChange={(e) => setModel(e.target.value)} disabled={busy} aria-label="Claude model" className={select}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value)} disabled={busy} aria-label="Tailoring strategy" className={select}>
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {research && (
          <Button type="button" variant="secondary" size="small" className="uppercase" disabled={blocked} onClick={runResearch}>
            {hasResearch ? "Research company again" : "Research company"}
          </Button>
        )}
        <Button type="button" size="small" className="uppercase" disabled={blocked} onClick={() => tailor()}>
          {retailor ? "Tailor again" : "Tailor with Claude"}
        </Button>
      </div>
      {questions && <JobQuestions questions={questions} onSubmit={answer} />}
      <RunCost calibrations={costs.calibrations} model={model} researchModel={research?.model ?? model} now={now} last={costs.last} />
      <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
        {runner === "offline" && (
          <>
            Start the runner on this Mac with <code className="font-mono text-text-secondary">npm run runner</code>, then reload.
          </>
        )}
        {progress}
        {error && <span className="text-red-primary">{error}</span>}
      </p>
    </div>
  );
}
