import { AddButton, RemoveButton, removeAt, updateAt } from "~/components/cv/entries";
import { Field } from "~/components/profile/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { newId } from "~/lib/cv";
import type { StarStory } from "~/types/cv";

const blank = (): StarStory => ({ id: newId(), title: "", text: "" });

export function StoryList({ value, onChange }: { value: StarStory[]; onChange: (v: StarStory[]) => void }) {
  const set = (i: number, patch: Partial<StarStory>) => onChange(updateAt(value, i, patch));
  return (
    <div className="flex flex-col gap-6">
      {!value.length && (
        <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
          Write down the moments you're proudest of: a hard problem, a conflict, a deadline, a failure you learned from. Rough notes are fine: prep turns them into STAR answers and fills what's missing from your CV.
        </p>
      )}
      {value.map((story, i) => (
        <article key={story.id} className="flex flex-col gap-4 border-b border-stroke-secondary pb-6">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Title">
                <Input value={story.title} maxLength={200} placeholder="Cut checkout latency in half" onChange={(e) => set(i, { title: e.target.value })} />
              </Field>
            </div>
            <RemoveButton label={`Remove ${story.title || "story"}`} onClick={() => onChange(removeAt(value, i))} />
          </div>
          <Field label="Story">
            <Textarea
              rows={6}
              maxLength={4000}
              value={story.text}
              placeholder="What happened, what you had to do, what you did and how it turned out. Leave gaps: prep fills them from your CV."
              onChange={(e) => set(i, { text: e.target.value })}
            />
          </Field>
        </article>
      ))}
      <AddButton label="Add story" onClick={() => onChange([...value, blank()])} />
    </div>
  );
}
