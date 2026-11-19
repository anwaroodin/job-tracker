import { AlertCircleIcon, FileEditIcon, Globe02Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSelector } from "@legendapp/state/react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLocation, useRevalidator } from "react-router";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/cn";
import { planUsage } from "~/lib/runner";
import { runOnce } from "~/lib/run-log";
import { RunnerOffline, useRunnerStatus } from "./runner";
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
  const runner = useRunnerStatus();
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
    if (runner === "ready") planUsage().then((now) => runCosts$.now.set(now));
  }, [runner]);

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
      const request = { model, ...research };
      const { result, usage, before, after } = await runOnce({ kind: "research", model: request.model, ...target }, request);
      recordRunCost(request.model, "research", { stages: [usage], before, after });
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
  const failed = session?.status === "failed" ? session.error : null;

  return (
    <div className="flex flex-col border border-stroke-secondary">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <label className="flex items-center gap-2 text-[12.5px] text-text-tertiary">
          Model
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={busy}
            className="h-9 border border-stroke-secondary bg-bg-primary px-2 text-[13.5px] text-text-primary hover:border-stroke-primary disabled:opacity-40"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {forJob && (
          <span className={busy ? "pointer-events-none opacity-50" : undefined}>
            <Switch checked={letter} onCheckedChange={setLetter} label="Cover letter" />
          </span>
        )}
        <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {research && (
            <Button type="button" variant="secondary" disabled={blocked || runnerTaken} onClick={runResearch}>
              <HugeiconsIcon icon={Globe02Icon} size={16} strokeWidth={1.5} />
              {hasResearch ? "Research again" : "Research company"}
            </Button>
          )}
          <Button type="button" disabled={blocked} onClick={tailor}>
            <HugeiconsIcon icon={retailor ? RefreshIcon : FileEditIcon} size={16} strokeWidth={1.5} />
            {retailor ? "Tailor again" : "Tailor CV"}
          </Button>
        </span>
      </div>

      {runner === "offline" && (
        <Notice tone="attention" title="The runner isn't running">
          <RunnerOffline />
        </Notice>
      )}
      {failed && (
        <Notice tone="error" title="Tailoring stopped" action={!blocked && <RetryButton onClick={tailor} />}>
          {failed}
        </Notice>
      )}
      {error && (
        <Notice tone="error" title="Company research failed">
          {error}
        </Notice>
      )}
      {progress && <p className="border-t border-stroke-secondary px-4 py-3 text-[13.5px] text-text-secondary">{progress}</p>}

      {session && !failed && (
        <div className="border-t border-stroke-secondary px-4 py-4">
          <TailorProgress session={session} />
        </div>
      )}
      {questions && (
        <div className="border-t border-stroke-secondary px-4 py-4">
          <JobQuestions questions={questions} onSubmit={(answers) => answerSession(id, answers)} />
        </div>
      )}
      {costs.now && (
        <div className="border-t border-stroke-secondary bg-sidebar px-4 py-2.5">
          <RunCost calibrations={costs.calibrations} model={model} now={costs.now} last={costs.last} />
        </div>
      )}
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" onClick={onClick}>
      <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.5} />
      Try again
    </Button>
  );
}

function Notice({ tone, title, action, children }: { tone: "error" | "attention"; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className="flex items-start gap-3 border-t border-stroke-secondary px-4 py-3">
      <HugeiconsIcon
        icon={AlertCircleIcon}
        size={18}
        strokeWidth={1.5}
        className={cn("mt-px shrink-0", tone === "error" ? "text-red-primary" : "text-accent-primary")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-text-primary">{title}</p>
        <p className="mt-0.5 break-words text-[13px] leading-relaxed text-text-secondary">{children}</p>
      </div>
      {action}
    </div>
  );
}
