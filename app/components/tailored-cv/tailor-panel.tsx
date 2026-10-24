import { useSelector } from "@legendapp/state/react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLocation, useRevalidator } from "react-router";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { planUsage, runnerAvailable, runOnRunner } from "~/lib/runner";
import { recordRunCost, runCosts$ } from "~/lib/state/run-costs";
import { answerSession, isActive, sessionId, startSession, tailoring$, type TailorTarget } from "~/lib/state/tailoring";
import type { TailorRequest } from "~/types/cv";
import { TailorProgress } from "./progress";
import { JobQuestions } from "./questions";
import { RunCost, useRunCosts } from "./run-cost";

const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];
const MODEL_KEY = "job-tracker/claude-model";
const LETTER_KEY = "job-tracker/cover-letter";

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

function useLetter() {
  const [letter, setLetter] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(LETTER_KEY) === "off") setLetter(false);
    } catch {}
  }, []);
  const choose = (on: boolean) => {
    setLetter(on);
    try {
      localStorage.setItem(LETTER_KEY, on ? "on" : "off");
    } catch {}
  };
  return [letter, choose] as const;
}

export function TailorPanel({
  target,
  company,
  role,
  research,
  hasResearch,
  retailor,
}: {
  target: TailorTarget;
  company: string;
  role: string;
  research: TailorRequest | null;
  hasResearch: boolean;
  retailor: boolean;
}) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const { pathname } = useLocation();
  const [runner, setRunner] = useState<"checking" | "ready" | "offline">("checking");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useModel();
  const [letter, setLetter] = useLetter();
  const forJob = "applicationId" in target;
  const costs = useRunCosts();
  const id = sessionId(target);
  const session = useSelector(() => tailoring$[id].get());
  const runnerTaken = useSelector(() => Object.values(tailoring$.get()).some((s) => s.status === "running"));
  const status = useRef(session?.status);

  useEffect(() => {
    runnerAvailable().then((ok) => {
      setRunner(ok ? "ready" : "offline");
      if (ok) planUsage().then((now) => runCosts$.now.set(now));
    });
  }, []);

  useEffect(() => {
    if (session?.status === "done" && status.current !== "done") revalidator.revalidate();
    status.current = session?.status;
  }, [session?.status]);

  const tailor = () => startSession({ company, role, href: pathname, target, model, letter });

  const runResearch = async () => {
    if (!research) return;
    setError(null);
    setProgress("Searching the web for the company's values and what it looks for…");
    try {
      const before = await planUsage();
      const { result, usage } = await runOnRunner({ model, ...research });
      recordRunCost(research.model ?? model, "research", {
        stages: [usage],
        before,
        after: await planUsage(),
      });
      fetcher.submit({ intent: "research", result: JSON.stringify(result) }, { method: "post" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const active = isActive(session);
  const questions = session?.status === "questions" ? session.questions : null;
  const busy = progress !== null || fetcher.state !== "idle" || active;
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
        {forJob && (
          <span className={busy ? "pointer-events-none opacity-50" : undefined}>
            <Switch checked={letter} onCheckedChange={setLetter} label="Cover letter" />
          </span>
        )}
        <span className="flex flex-wrap items-center gap-3 sm:ml-auto">
          {research && (
            <Button type="button" variant="secondary" size="small" className="uppercase" disabled={blocked || runnerTaken} onClick={runResearch}>
              {hasResearch ? "Research company again" : "Research company"}
            </Button>
          )}
          <Button type="button" size="small" className="uppercase" disabled={blocked} onClick={tailor}>
            {retailor ? "Tailor again" : "Tailor with Claude"}
          </Button>
        </span>
      </div>
      {session && <TailorProgress session={session} />}
      {questions && <JobQuestions questions={questions} onSubmit={(answers) => answerSession(id, answers)} />}
      <RunCost calibrations={costs.calibrations} model={model} now={costs.now} last={costs.last} />
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
