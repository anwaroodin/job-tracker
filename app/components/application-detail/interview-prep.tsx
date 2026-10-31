import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Points } from "~/components/tailored-cv/research";
import { Section, fmtDate } from "~/components/ui/terminal";
import { RunnerOffline, useRunnerStatus } from "~/components/tailored-cv/runner";
import { runOnRunner } from "~/lib/runner";
import type { InterviewPrep as Prep, TailorRequest } from "~/types/cv";

export function InterviewPrep({ n, prep, request }: { n: string; prep: Prep | null; request: TailorRequest | null }) {
  const fetcher = useFetcher();
  const runner = useRunnerStatus();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepare = async () => {
    if (!request) return;
    setError(null);
    setRunning(true);
    try {
      const { result } = await runOnRunner(request);
      fetcher.submit({ intent: "prep", result: JSON.stringify(result) }, { method: "post" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const busy = running || fetcher.state !== "idle";
  return (
    <Section n={n} id="prep" title="Interview prep" hint={prep ? `Prepared ${fmtDate(prep.preparedAt)}` : undefined} i={2}>
      <div className="flex flex-col gap-6">
        {!prep && (
          <p className="font-sans text-[13px] normal-case tracking-normal text-text-secondary">
            Likely questions with STAR answers built from your stories and CV, questions to ask them, and what to brush up on.
          </p>
        )}
        {prep && <PrepView prep={prep} />}
        <div className="flex flex-wrap items-center gap-3">
          {request ? (
            <Button type="button" size="small" className="uppercase" disabled={busy || runner !== "ready"} onClick={prepare}>
              {busy ? "Preparing…" : prep ? "Prepare again" : "Prepare for the interview"}
            </Button>
          ) : (
            <span className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
              Add the job description in Edit to prepare from it.
            </span>
          )}
          <span className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
            {request && runner === "offline" && <RunnerOffline />}
            {error && <span className="text-red-primary">{error}</span>}
          </span>
        </div>
      </div>
    </Section>
  );
}

const STAR = [
  ["S", "situation"],
  ["T", "task"],
  ["A", "action"],
  ["R", "result"],
] as const;

function PrepView({ prep }: { prep: Prep }) {
  return (
    <>
      <ol className="flex flex-col divide-y divide-dashed divide-stroke-primary/50">
        {prep.questions.map((q, i) => (
          <li key={q.question}>
            <details className="group py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
                <span className="text-text-tertiary tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 font-sans text-[14px] normal-case tracking-normal text-text-primary">{q.question}</span>
                <span aria-hidden className="text-text-tertiary transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="flex flex-col gap-3 pl-8 pt-2">
                <p className="font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">
                  {q.why} {q.story ? `Built from your story “${q.story}”.` : "Built from your CV. Add a STAR story in Interviews to make it yours."}
                </p>
                <dl className="flex flex-col gap-2.5">
                  {STAR.map(([letter, field]) => (
                    <div key={field} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                      <dt className="text-text-tertiary">
                        <span aria-hidden>{letter}</span>
                        <span className="sr-only">{field}</span>
                      </dt>
                      <dd className="font-sans text-[13.5px] normal-case leading-relaxed tracking-normal text-text-secondary">{q.answer[field]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Points title="Ask them" items={prep.askThem} />
        <Points title="Brush up on" items={prep.brushUp} />
      </div>
    </>
  );
}
