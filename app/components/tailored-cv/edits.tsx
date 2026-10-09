import { RichText } from "~/components/ui/rich-text";
import { wordDiff } from "~/lib/word-diff";
import type { ResumeChange, TailoredCv } from "~/types/cv";

const KINDS: Record<ResumeChange["action"], { tag: string; color: string }> = {
  replace: { tag: "reworded", color: "text-accent-primary" },
  append: { tag: "new bullet", color: "text-green-primary" },
  add_skill: { tag: "new skill", color: "text-green-primary" },
  reorder: { tag: "reordered", color: "text-text-tertiary" },
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

export function EditsView({ cv, keywords }: { cv: TailoredCv; keywords: string[] }) {
  const pattern = keywordPattern(keywords);
  const edits = cv.edits ?? [];

  return (
    <div className="flex flex-col gap-5">
      {cv.flags.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {cv.flags.map((flag) => (
            <li key={flag} className="flex items-baseline gap-3">
              <span className="shrink-0 text-[11px] tracking-[0.08em] text-accent-primary">[!]</span>
              <span className="font-sans text-[13px] normal-case tracking-normal text-text-secondary">{flag}</span>
            </li>
          ))}
        </ul>
      )}
      {cv.changes.map((note) => (
        <RichText key={note} text={note} className="text-[13px]" />
      ))}

      {edits.length > 0 && (
        <div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-b border-stroke-secondary pb-3 text-[10.5px] tracking-[0.1em] text-text-tertiary">
            <span>
              <span className="text-green-primary">green</span> added
            </span>
            <span>
              <span className="line-through">struck</span> removed
            </span>
            <span>
              <span className={KEYWORD}>dotted</span> job keyword
            </span>
          </p>
          <ol>
            {edits.map((edit, i) => (
              <li key={i} className="border-b border-stroke-secondary py-4">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tracking-[0.08em]">
                  <span className={KINDS[edit.action].color}>[{KINDS[edit.action].tag}]</span>
                  <span className="text-text-tertiary">{place(edit.path, cv)}</span>
                </p>
                <p className={"mt-1.5 font-sans text-[14px] normal-case leading-relaxed tracking-normal text-text-primary"}>
                  <Diff edit={edit} pattern={pattern} />
                </p>
                {edit.reason && <p className="mt-1.5 font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">{edit.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {!!cv.rejectedEdits && (
        <p className="font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">
          {cv.rejectedEdits} proposed change(s) failed verification and weren't applied.
        </p>
      )}
    </div>
  );
}
