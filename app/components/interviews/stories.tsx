import { FileImportIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { AddButton, Entry, EntryList, removeAt, updateAt } from "~/components/cv/entries";
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
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <div className="border border-stroke-secondary px-6 py-10 text-center">
          <p className="font-medium text-text-primary">No stories yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed text-text-tertiary">
            Write down a hard problem, a conflict, a tight deadline or a failure you learned from. Rough notes are fine.
          </p>
        </div>
      ) : (
        <EntryList>
          {value.map((story, i) => (
            <Entry
              key={story.id}
              heading={story.title || "New story"}
              sub={story.text.split("\n")[0] || undefined}
              onRemove={() => onChange(removeAt(value, i))}
            >
              <Field label="Title">
                <Input value={story.title} maxLength={200} placeholder="Cut checkout latency in half" onChange={(e) => set(i, { title: e.target.value })} />
              </Field>
              <Field label="What happened">
                <Textarea
                  rows={4}
                  maxLength={4000}
                  value={story.text}
                  placeholder="The situation, what you had to do, what you did and how it turned out. Leave gaps: prep fills them from your CV."
                  onChange={(e) => set(i, { text: e.target.value })}
                  className="text-[14px] leading-relaxed [field-sizing:content]"
                />
              </Field>
            </Entry>
          ))}
        </EntryList>
      )}
      <AddButton label="Story" onClick={() => onChange([...value, blank()])} />
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

  const note = "text-[13.5px] text-text-tertiary";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {request ? (
        <Button
          type="button"
          variant="secondary"
          size="small"
          className="h-9 gap-2 border-stroke-secondary bg-bg-primary px-3 text-[13.5px] text-text-primary hover:border-stroke-primary hover:bg-bg-primary"
          disabled={running || runner !== "ready"}
          onClick={draft}
        >
          <HugeiconsIcon icon={FileImportIcon} size={16} strokeWidth={1.5} />
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
      {error && <span className="text-[13.5px] text-red-primary">{error}</span>}
    </div>
  );
}
