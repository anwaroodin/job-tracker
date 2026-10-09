import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import type { Confirmation } from "~/types/cv";
import { RemoveButton, removeAt, updateAt } from "./entries";

export function AnswerList({ value, onChange }: { value: Confirmation[]; onChange: (v: Confirmation[]) => void }) {
  if (!value.length) {
    return (
      <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
        When a job asks for something your CV doesn't show, tailoring asks you about it. Your answers appear here.
      </p>
    );
  }
  const set = (i: number, patch: Partial<Confirmation>) => onChange(updateAt(value, i, patch));
  return (
    <ul>
      {value.map((answer, i) => (
        <li key={answer.term} className="flex flex-col gap-2 border-b border-stroke-secondary py-3 first:border-t">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="min-w-0 flex-1 font-sans text-[13.5px] normal-case tracking-normal text-text-primary">{answer.term}</span>
            <Switch checked={answer.has} onCheckedChange={(has) => set(i, { has })} label={answer.has ? "Have it" : "Don't have it"} />
            <RemoveButton label={`Forget ${answer.term}`} onClick={() => onChange(removeAt(value, i))} />
          </div>
          <Textarea
            rows={2}
            maxLength={500}
            value={answer.detail}
            placeholder={answer.has ? "More detail: where, how, or how much (optional)" : "Anything related you have instead? (optional)"}
            onChange={(e) => set(i, { detail: e.target.value })}
          />
        </li>
      ))}
    </ul>
  );
}
