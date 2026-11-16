import { PageSection } from "~/components/ui/page-section";
import { useState } from "react";
import { RichText, type Highlight } from "~/components/ui/rich-text";
import { cn } from "~/lib/cn";

const LONG = 1200;

export function JobDescription({ text, source, highlights = [] }: { text: string; source?: string; highlights?: Highlight[] }) {
  const long = text.length > LONG;
  const [open, setOpen] = useState(false);

  return (
    <PageSection id="description" title="Job description" description={source ? `From ${source}` : undefined}>
      {highlights.length > 0 && <HighlightKey />}
      <div className={cn("relative max-w-prose", long && !open && "max-h-72 overflow-hidden")}>
        <RichText text={text} highlights={highlights} />
        {long && !open && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-primary to-transparent" />
        )}
      </div>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-3 self-start text-[12.5px] text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {open ? "Show less" : "Show full description"}
        </button>
      )}
    </PageSection>
  );
}

export function HighlightKey() {
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-4 bg-accent-primary/15" />
        Required skill
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="w-4 border-b border-dotted border-stroke-primary" />
        Preferred skill or keyword
      </span>
    </p>
  );
}
