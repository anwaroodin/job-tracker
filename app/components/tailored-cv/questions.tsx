import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/cn";
import type { Confirmation, JobQuestion } from "~/types/cv";

type Answer = { has: boolean | null; detail: string };

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <Button type="button" size="tiny" variant={active ? "primary" : "secondary"} className="uppercase" aria-pressed={active} onClick={onClick}>
      {children}
    </Button>
  );
}

export function JobQuestions({ questions, onSubmit }: { questions: JobQuestion[]; onSubmit: (answers: Confirmation[]) => void }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const answer = (term: string) => answers[term] ?? { has: null, detail: "" };
  const set = (term: string, patch: Partial<Answer>) => setAnswers((all) => ({ ...all, [term]: { ...answer(term), ...patch } }));
  const confirmed = questions.flatMap(({ term }) => {
    const { has, detail } = answer(term);
    return has === null ? [] : [{ term, has, detail: detail.trim() }];
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl font-sans text-[13px] normal-case leading-relaxed tracking-normal text-text-secondary">
        The job asks for these and your CV doesn't show them. Say which you have, so tailoring can use them instead of guessing. Your answers are saved
        to your CV, so you're only asked once.
      </p>
      <ul>
        {questions.map(({ term, kind }) => {
          const { has, detail } = answer(term);
          return (
            <li key={term} className="flex flex-col gap-2 border-b border-stroke-secondary py-3 first:border-t">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1 font-sans text-[13.5px] normal-case tracking-normal text-text-primary">
                  {term}
                  <span className={cn("ml-3 font-mono text-[10.5px] uppercase tracking-[0.08em]", kind === "required" ? "text-accent-primary" : "text-text-tertiary")}>
                    [{kind}]
                  </span>
                </span>
                <div className="flex gap-2">
                  <Choice active={has === true} onClick={() => set(term, { has: true })}>
                    Yes
                  </Choice>
                  <Choice active={has === false} onClick={() => set(term, { has: false })}>
                    No
                  </Choice>
                </div>
              </div>
              <Textarea
                rows={2}
                maxLength={500}
                value={detail}
                placeholder={has === false ? "Anything related you have instead? (optional)" : "More detail: where, how, or how much (optional)"}
                onChange={(e) => set(term, { detail: e.target.value })}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="small" className="uppercase" onClick={() => onSubmit(confirmed)}>
          Continue tailoring
        </Button>
        <Button type="button" variant="ghost" size="small" className="uppercase" onClick={() => onSubmit([])}>
          Skip questions
        </Button>
        <span className="font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">
          {confirmed.length} of {questions.length} answered
        </span>
      </div>
    </div>
  );
}
