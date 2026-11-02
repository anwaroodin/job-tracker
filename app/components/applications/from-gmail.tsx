import { useState } from "react";
import { ApplicationSuggestions } from "~/components/applications/application-suggestions";
import { UnsureEmailRow } from "~/components/applications/unsure-emails-banner";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import type { Suggestion } from "~/types/suggestion";
import type { UnsureEmail } from "~/types/unsure-email";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function FromGmail({
  suggestions,
  unsure,
  accountEmail,
}: {
  suggestions: Suggestion[];
  unsure: UnsureEmail[];
  accountEmail: string;
}) {
  if (!suggestions.length && !unsure.length) return null;
  return (
    <div className="divide-y divide-dashed divide-stroke-secondary border border-dashed border-stroke-secondary text-[11px]">
      {suggestions.length > 0 && (
        <Review
          highlight
          label={`${plural(suggestions.length, "untracked application", "untracked applications")} found in your Gmail`}
        >
          <ApplicationSuggestions suggestions={suggestions} accountEmail={accountEmail} />
        </Review>
      )}
      {unsure.length > 0 && (
        <Review label={`${plural(unsure.length, "email", "emails")} might not be about jobs. Kept until you decide.`}>
          <p className="eyebrow pb-1">1 of {unsure.length}</p>
          <ul>
            <UnsureEmailRow key={unsure[0].id} email={unsure[0]} />
          </ul>
        </Review>
      )}
    </div>
  );
}

function Review({ label, highlight, children }: { label: string; highlight?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("px-3.5 py-2.5", highlight && "bg-accent-quaternary/20")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={cn("flex items-center gap-2", highlight ? "text-accent-primary" : "text-text-secondary")}>
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", highlight ? "bg-accent-primary" : "bg-text-tertiary")} />
          {label}
        </span>
        <Button type="button" variant="ghost" size="tiny" className="uppercase" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "[Hide ▲]" : "[Review ▼]"}
        </Button>
      </div>
      {open && <div className="mt-3 border-t border-dashed border-stroke-secondary pt-3">{children}</div>}
    </div>
  );
}
