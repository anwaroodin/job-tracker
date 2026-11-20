import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { SideBlock } from "~/components/ui/side-block";
import { shortDate } from "~/components/ui/terminal";
import { RunnerOffline, useRunnerStatus } from "~/components/tailored-cv/runner";
import { runOnce } from "~/lib/run-log";
import type { InterviewPrep as Prep, InterviewQuestion, TailorRequest } from "~/types/cv";

export function PrepareBlock({ prep, request }: { prep: Prep | null; request: TailorRequest | null }) {
  const fetcher = useFetcher();
  const runner = useRunnerStatus();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepare = async () => {
    if (!request) return;
    setError(null);
    setRunning(true);
    try {
      const { result } = await runOnce({ kind: "prep", model: request.model ?? "default" }, request);
      fetcher.submit({ intent: "prep", result: JSON.stringify(result) }, { method: "post" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const busy = running || fetcher.state !== "idle";
  return (
    <SideBlock title="This prep" aside={prep ? `Prepared ${shortDate(prep.preparedAt)}` : "Not prepared yet"}>
      {request ? (
        <Button
          type="button"
          variant={prep ? "secondary" : "primary"}
          disabled={busy || runner !== "ready"}
          onClick={prepare}
          className={
            prep
              ? "h-9 self-start border-stroke-secondary bg-bg-primary px-3.5 text-[13.5px] text-text-primary hover:border-stroke-primary hover:bg-bg-primary"
              : "h-9 self-start px-3.5 text-[13.5px]"
          }
        >
          {busy ? "Preparing…" : prep ? "Prepare again" : "Prepare for the interview"}
        </Button>
      ) : (
        <p className="text-[13px] text-text-tertiary">Add the job description in Edit to prepare from it.</p>
      )}
      {request && runner === "offline" && (
        <p className="text-[13px] leading-relaxed text-text-tertiary">
          <RunnerOffline />
        </p>
      )}
      {error && <p className="text-[13px] text-red-primary">{error}</p>}
    </SideBlock>
  );
}

export function PrepList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <SideBlock title={title}>
      <ul className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-text-secondary">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-text-tertiary" />
            {item}
          </li>
        ))}
      </ul>
    </SideBlock>
  );
}

const STAR = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

export function PrepQuestions({ questions }: { questions: InterviewQuestion[] }) {
  return (
    <ol className="-mt-5 flex flex-col">
      {questions.map((q, i) => (
        <li key={q.question} className="border-b border-stroke-secondary">
          <details className="group" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-start gap-4 py-4 hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
              <span className="w-6 pt-px text-[13px] tabular-nums text-text-tertiary">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 text-[15px] font-medium leading-snug text-text-primary">{q.question}</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-text-tertiary transition-transform group-open:rotate-90" />
            </summary>
            <div className="flex max-w-prose flex-col gap-5 pb-6 pl-10 pr-6">
              {q.why && <p className="text-[13px] leading-relaxed text-text-tertiary">Why they ask: {q.why}</p>}
              <dl className="flex flex-col gap-4">
                {STAR.map(([field, label]) => (
                  <div key={field} className="flex flex-col gap-1">
                    <dt className="text-[12.5px] font-medium text-text-tertiary">{label}</dt>
                    <dd className="text-[14px] leading-relaxed text-text-secondary">{q.answer[field]}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[12.5px] text-text-tertiary">
                {q.story ? `Built from your story “${q.story}”.` : "Built from your CV. Add a STAR story in Interviews to make it yours."}
              </p>
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
