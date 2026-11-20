import { ArrowTurnBackwardIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { RichText } from "~/components/ui/rich-text";
import { wordDiff } from "~/lib/word-diff";
import type { ResumeChange, TailoredCv } from "~/types/cv";

const KINDS: Record<ResumeChange["action"], { tag: string; dot: string }> = {
  replace: { tag: "Reworded", dot: "bg-accent-primary" },
  append: { tag: "New bullet", dot: "bg-green-primary" },
  add_skill: { tag: "New skill", dot: "bg-green-primary" },
  reorder: { tag: "Reordered", dot: "bg-text-tertiary" },
};

const KEYWORD = "underline decoration-dotted decoration-1 underline-offset-[5px]";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function keywordPattern(keywords: string[]) {
  const terms = keywords.filter(Boolean).sort((a, b) => b.length - a.length).map(escape);
  return terms.length ? new RegExp(`(?<!\\w)(${terms.join("|")})(?!\\w)`, "gi") : null;
}

function Added({ text, pattern }: { text: string; pattern: RegExp | null }) {
  const pieces = pattern ? text.split(pattern) : [text];
  return (
    <span className="text-green-primary">
      {pieces.map((piece, i) =>
        i % 2 ? (
          <span key={i} className={KEYWORD}>
            {piece}
          </span>
        ) : (
          piece
        ),
      )}
    </span>
  );
}

function Diff({ edit, pattern }: { edit: ResumeChange; pattern: RegExp | null }) {
  if (Array.isArray(edit.value)) return <span className="text-text-secondary">{edit.value.join(", ")}</span>;
  if (edit.action !== "replace") return <Added text={edit.value} pattern={pattern} />;
  return (
    <>
      {wordDiff(edit.original ?? "", edit.value).map((part, i) => (
        <span key={i}>
          {i > 0 && " "}
          {part.kind === "same" && part.text}
          {part.kind === "removed" && <span className="text-text-tertiary line-through decoration-text-tertiary">{part.text}</span>}
          {part.kind === "added" && <Added text={part.text} pattern={pattern} />}
        </span>
      ))}
    </>
  );
}

function place(path: string, cv: TailoredCv) {
  if (path === "summary") return "Summary";
  if (path === "certifications") return "Certifications";
  const group = /^skills\[(\d+)\]/.exec(path);
  if (group) return cv.skills[Number(group[1])]?.label || "Skills";
  const entry = /^(workExperience|personalProjects|education)\[(\d+)\]\.description(?:\[(\d+)\])?/.exec(path);
  if (!entry) return path;
  const i = Number(entry[2]);
  const name =
    entry[1] === "workExperience" ? cv.experience[i]?.company : entry[1] === "personalProjects" ? cv.projects[i]?.name : cv.education[i]?.institution;
  return entry[3] === undefined ? name || "Entry" : `${name || "Entry"} · bullet ${Number(entry[3]) + 1}`;
}

const canRevert = (edit: ResumeChange) => typeof edit.value === "string" && (edit.action !== "replace" || edit.original !== null);

function RevertButton({ index }: { index: number }) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const reverting = fetcher.state !== "idle";
  return (
    <span className="ml-auto flex items-center gap-2">
      {!reverting && fetcher.data?.error && <span className="text-red-primary">{fetcher.data.error}</span>}
      <Button
        type="button"
        variant="ghost"
        disabled={reverting}
        onClick={() => fetcher.submit({ intent: "revert", index: String(index) }, { method: "post" })}
        className="h-7 gap-1.5 px-2 font-sans text-[12.5px] normal-case tracking-normal text-text-secondary hover:bg-ink/[0.04] hover:text-text-primary"
      >
        <HugeiconsIcon icon={reverting ? Loading03Icon : ArrowTurnBackwardIcon} size={14} strokeWidth={1.5} className={reverting ? "animate-spin" : undefined} />
        {reverting ? "Reverting…" : "Revert"}
      </Button>
    </span>
  );
}

export function EditsView({ cv, keywords }: { cv: TailoredCv; keywords: string[] }) {
  const pattern = keywordPattern(keywords);
  const edits = cv.edits ?? [];

  return (
    <div className="flex flex-col gap-5">
      {cv.flags.length > 0 && (
        <div className="border border-stroke-secondary px-4 py-3">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-text-primary">
            <span aria-hidden className="size-2 rounded-full bg-accent-primary" />
            {cv.flags.length === 1 ? "1 thing to check" : `${cv.flags.length} things to check`}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 pl-4">
            {cv.flags.map((flag) => (
              <li key={flag} className="text-[13.5px] leading-relaxed text-text-secondary">
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cv.changes.map((note) => (
        <RichText key={note} text={note} className="text-[13px]" />
      ))}

      {edits.length > 0 && (
        <div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-b border-stroke-secondary pb-3 text-[12.5px] text-text-tertiary">
            <span>
              <span className="text-green-primary">Green</span> added
            </span>
            <span>
              <span className="line-through">Struck</span> removed
            </span>
            <span>
              <span className={KEYWORD}>Dotted</span> job keyword
            </span>
          </p>
          <ol>
            {edits.map((edit, i) => (
              <li key={i} className="border-b border-stroke-secondary py-4 last:border-b-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-tertiary">
                  <span aria-hidden className={`size-1.5 rounded-full ${KINDS[edit.action].dot}`} />
                  <span className="font-medium text-text-secondary">{KINDS[edit.action].tag}</span>
                  <span>· {place(edit.path, cv)}</span>
                  {canRevert(edit) && <RevertButton index={i} />}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-text-primary">
                  <Diff edit={edit} pattern={pattern} />
                </p>
                {edit.reason && <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-tertiary">{edit.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!!cv.rejectedEdits && (
        <p className="text-[12.5px] text-text-tertiary">
          {cv.rejectedEdits === 1 ? "1 proposed change" : `${cv.rejectedEdits} proposed changes`} failed verification and weren't applied.
        </p>
      )}
    </div>
  );
}
