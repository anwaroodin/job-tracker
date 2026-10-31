import { useState } from "react";
import { AddButton, RemoveButton, removeAt, updateAt } from "~/components/cv/entries";
import { Field } from "~/components/profile/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { newId } from "~/lib/cv";
import { RunnerOffline, useRunnerStatus } from "~/components/tailored-cv/runner";
import { runOnRunner } from "~/lib/runner";
import type { StarStory, TailorRequest } from "~/types/cv";

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

function drafted(result: unknown): StarStory[] {
  const stories = (result as { stories?: unknown })?.stories;
  if (!Array.isArray(stories)) return [];
  return stories.flatMap((s) =>
    typeof s?.title === "string" && typeof s?.text === "string" ? [{ id: newId(), title: s.title.trim().slice(0, 200), text: s.text.trim().slice(0, 4000) }] : [],
  );
}

export function DraftStories({ request, onDrafted }: { request: TailorRequest | null; onDrafted: (stories: StarStory[]) => void }) {
  const runner = useRunnerStatus();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = async () => {
    if (!request) return;
    setError(null);
    setRunning(true);
    try {
      const stories = drafted((await runOnRunner(request)).result);
      if (stories.length) onDrafted(stories);
      else setError("No stories came back. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const note = "font-sans text-[13px] normal-case tracking-normal text-text-tertiary";
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {request ? (
        <Button type="button" variant="secondary" size="small" className="uppercase" disabled={running || runner !== "ready"} onClick={draft}>
          {running ? "Drafting…" : "Draft stories from my CV"}
        </Button>
      ) : (
        <span className={note}>Add your experience or projects to your CV to draft stories from it.</span>
      )}
      {request && runner === "offline" && (
        <span className={note}>
          <RunnerOffline />
        </span>
      )}
      {request && !error && runner === "ready" && <span className={note}>Drafts land below with gaps marked [like this]. Edit, then save.</span>}
      {error && <span className="font-sans text-[13px] normal-case tracking-normal text-red-primary">{error}</span>}
    </div>
  );
}
