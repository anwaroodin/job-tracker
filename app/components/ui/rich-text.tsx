import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

type Block = { kind: "heading"; text: string } | { kind: "list"; items: string[] } | { kind: "paragraph"; text: string };

const BULLET = /^(?:[•·▪◦●‣∙*–\-→➔➜►▸✓✔]|\d{1,2}[.)])\s+/;
const HEADING_MAX = 60;

/**
 * Splits light markup into blocks. The extension marks headings with "## "
 * and list items with "• ", but many listings write headings as plain lines,
 * so a short line ending in ":" or leading into a list is read as a heading too.
 */
function parse(text: string): Block[] {
  const lines = text.split("\n").map((l) => l.trim());
  const blocks: Block[] = [];

  lines.forEach((line, i) => {
    if (!line) return;
    if (line.startsWith("## ")) {
      blocks.push({ kind: "heading", text: line.slice(3).replace(/:$/, "") });
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
    if (short && (line.endsWith(":") || BULLET.test(next))) {
      blocks.push({ kind: "heading", text: line.replace(/:$/, "") });
      return;
    }
    blocks.push({ kind: "paragraph", text: line });
  });
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-medium text-text-primary">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** Light markup (a captured job description, Claude's notes) laid out as headings, lists and paragraphs. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex max-w-[72ch] flex-col font-sans text-[14px] normal-case leading-[1.7] tracking-normal", className)}>
      {parse(text).map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h3
              key={i}
              className="mb-2 mt-7 font-mono text-[11.5px] uppercase tracking-[0.1em] text-text-primary first:mt-0"
            >
              <span aria-hidden className="mr-2 text-text-tertiary">
                ##
              </span>
              {inline(block.text)}
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="mb-3 flex flex-col gap-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="grid grid-cols-[18px_1fr] text-text-secondary">
                  <span aria-hidden className="font-mono text-text-tertiary">
                    ›
                  </span>
                  <span>{inline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mb-3 text-text-secondary">
            {inline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
