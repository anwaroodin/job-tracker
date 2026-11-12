import { PageSection } from "~/components/ui/page-section";
import { useState } from "react";
import { RichText } from "~/components/ui/rich-text";
import { cn } from "~/lib/cn";

const LONG = 1200;

export function JobDescription({ text, source }: { text: string; source?: string }) {
  const long = text.length > LONG;
  const [open, setOpen] = useState(false);

  return (
    <PageSection id="description" title="Job description" description={source ? `From ${source}` : undefined}>
      <div className={cn("relative max-w-prose", long && !open && "max-h-72 overflow-hidden")}>
        <RichText text={text} />
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
