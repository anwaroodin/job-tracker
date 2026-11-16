import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/cn";
import type { Confirmation, JobQuestion } from "~/types/cv";


type Answer = { has: boolean | null; detail: string };

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-pointer select-none items-center px-3 text-[13px] font-medium transition-colors",
        active ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
      )}
    >
      {children}
    </button>
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
      <div>
        <p className="font-medium text-text-primary">
          {questions.length} {questions.length === 1 ? "question" : "questions"} before tailoring carries on
        </p>
        <p className="mt-0.5 max-w-2xl text-[13.5px] leading-relaxed text-text-tertiary">
          The job asks for these and your CV doesn't show them. Say which you have, so tailoring can use them instead of guessing. Answers are saved to
          your CV, so you're only asked once.
        </p>
      </div>
      <ul>
        {questions.map(({ term, kind }) => {
          const { has, detail } = answer(term);
          return (
            <li key={term} className="flex flex-col gap-2 border-b border-stroke-secondary py-3 first:border-t">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-text-primary">{term}</span>
                  <span className={cn("text-[12.5px]", kind === "required" ? "text-accent-primary" : "text-text-tertiary")}>
                    {kind === "required" ? "Required" : kind === "preferred" ? "Preferred" : "Keyword in the job"}
                  </span>
                </span>
                <div className="flex gap-1" role="group" aria-label={`Do you have ${term}?`}>
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
                className="text-[13.5px] [field-sizing:content]"
                value={detail}
                placeholder={has === false ? "Anything related you have instead? (optional)" : "More detail: where, how, or how much (optional)"}
                onChange={(e) => set(term, { detail: e.target.value })}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => onSubmit(confirmed)}>
          Continue tailoring
        </Button>
        <Button type="button" variant="ghost" onClick={() => onSubmit([])}>
          Skip questions
        </Button>
        <span className="text-[12.5px] tabular-nums text-text-tertiary">
          {confirmed.length} of {questions.length} answered
        </span>
      </div>
    </div>
  );
}
