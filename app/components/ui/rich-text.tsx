import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

type Block = { kind: "heading"; text: string } | { kind: "list"; items: string[] } | { kind: "paragraph"; text: string };

export type Highlight = { term: string; kind: "required" | "preferred" | "keyword" };

const BULLET = /^(?:[•·▪◦●‣∙*–\-→➔➜►▸✓✔]|\d{1,2}[.)])\s+/;
const HEADING_MAX = 60;

function parse(text: string): Block[] {
  const lines = text.split("\n").map((l) => l.trim());
  const blocks: Block[] = [];

  lines.forEach((line, i) => {
    if (!line) return;
    if (/^#{1,6} /.test(line)) {
      blocks.push({ kind: "heading", text: line.replace(/^#+ /, "").replace(/:$/, "") });
      return;
    }
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "");
      const last = blocks.at(-1);
      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
      return;
    }
    const next = lines.slice(i + 1).find(Boolean) ?? "";
    const short = line.length <= HEADING_MAX && !/[.!?,;]$/.test(line);
    if (short && (line.endsWith(":") || BULLET.test(next) || /^\*\*[^*]+\*\*:?$/.test(line))) {
      blocks.push({ kind: "heading", text: line.replace(/^\*\*(.+)\*\*:?$/, "$1").replace(/:$/, "") });
      return;
    }
    blocks.push({ kind: "paragraph", text: line });
  });
  return blocks;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matcher(highlights: Highlight[]) {
  const terms = highlights.map((h) => h.term.trim()).filter((t) => t.length > 1);
  if (!terms.length) return null;
  const kinds = new Map(highlights.map((h) => [h.term.trim().toLowerCase(), h.kind]));
  const pattern = [...new Set(terms)].sort((a, b) => b.length - a.length).map(escape).join("|");
  return { regex: new RegExp(`(?<![\\w])(${pattern})(?![\\w])`, "gi"), kind: (t: string) => kinds.get(t.toLowerCase()) ?? "keyword" };
}

type Matcher = ReturnType<typeof matcher>;

function marked(text: string, m: Matcher, key: string): ReactNode[] {
  if (!m) return [text];
  return text.split(m.regex).map((part, i) =>
    i % 2 ? (
      <mark
        key={`${key}-${i}`}
        className={cn(
          "bg-transparent font-medium text-text-primary",
          m.kind(part) === "required" ? "bg-accent-primary/15 px-0.5" : "underline decoration-stroke-primary decoration-dotted underline-offset-4",
        )}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function inline(text: string, m: Matcher): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).flatMap((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-medium text-text-primary">
        {marked(part, m, String(i))}
      </strong>
    ) : (
      marked(part, m, String(i))
    ),
  );
}

export function RichText({ text, className, highlights = [] }: { text: string; className?: string; highlights?: Highlight[] }) {
  const m = matcher(highlights);
  return (
    <div className={cn("flex max-w-[72ch] flex-col font-sans text-[14px] normal-case leading-[1.7] tracking-normal", className)}>
      {parse(text).map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h3 key={i} className="mb-2 mt-6 text-[15px] font-medium leading-snug text-text-primary first:mt-0">
              {inline(block.text, null)}
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="mb-3 flex flex-col gap-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="grid grid-cols-[16px_1fr] text-text-secondary">
                  <span aria-hidden className="mt-[0.7em] size-1 rounded-full bg-text-tertiary" />
                  <span>{inline(item, m)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mb-3 text-text-secondary">
            {inline(block.text, m)}
          </p>
        );
      })}
    </div>
  );
}
