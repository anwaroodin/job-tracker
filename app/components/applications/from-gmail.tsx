import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { ApplicationSuggestions } from "~/components/applications/application-suggestions";
import { UnsureEmailRow } from "~/components/applications/unsure-emails-banner";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import type { Suggestion } from "~/types/suggestion";
import type { UnsureEmail } from "~/types/unsure-email";

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
    <div className="divide-y divide-stroke-secondary border border-stroke-secondary font-sans text-[14px] normal-case tracking-normal">
      {suggestions.length > 0 && (
        <Review
          count={suggestions.length}
          title={`${suggestions.length === 1 ? "application" : "applications"} in your Gmail ${suggestions.length === 1 ? "isn't" : "aren't"} tracked yet`}
        >
          <ApplicationSuggestions suggestions={suggestions} accountEmail={accountEmail} />
        </Review>
      )}
      {unsure.length > 0 && (
        <Review count={unsure.length} title={`${unsure.length === 1 ? "email" : "emails"} might not be about jobs. Kept until you decide.`}>
          <p className="pb-1 text-[12.5px] text-text-tertiary">1 of {unsure.length}</p>
          <ul>
            <UnsureEmailRow key={unsure[0].id} email={unsure[0]} />
          </ul>
        </Review>
      )}
    </div>
  );
}

function Review({ count, title, children }: { count: number; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-text-secondary">
          <span className="font-medium tabular-nums text-text-primary">{count}</span> {title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="small"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 shrink-0 font-sans text-[13px] normal-case tracking-normal text-text-primary"
        >
          {open ? "Hide" : "Review"}
          <HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.5} className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      {open && <div className="-mx-4 mt-2.5 border-t border-stroke-secondary">{children}</div>}
    </div>
  );
}
