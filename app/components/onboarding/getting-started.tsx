import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Meter } from "~/components/ui/meter";
import { cn } from "~/lib/cn";
import { onboarding$ } from "~/lib/state/onboarding";
import { LESSON_IDS, LESSONS } from "./lessons";
import { useLessons } from "./use-lessons";

export function GettingStarted({ gmailConnected }: { gmailConnected: boolean }) {
  const { finished, count, total, show } = useLessons(gmailConnected);
  if (!show) return null;

  return (
    <section id="getting-started" className="flex flex-col gap-3 lg:hidden">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[16px] font-medium text-text-primary">Getting started</h2>
          <span className="text-[13.5px] tabular-nums text-text-tertiary">
            {count} of {total} done
          </span>
        </div>
        <Button type="button" variant="ghost" className="h-8 px-2.5 text-[13px] text-text-tertiary" onClick={() => onboarding$.hidden.set(true)}>
          Hide
        </Button>
      </header>
      <Meter share={(count / total) * 100} className="bg-green-primary" />
      <ul className="flex flex-col border border-stroke-secondary">
        {LESSON_IDS.map((id) => {
          const done = finished(id);
          return (
            <li key={id} className="border-b border-stroke-secondary last:border-b-0">
              <Link to={`?lesson=${id}`} preventScrollReset className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-ink/[0.04]">
                {done ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} strokeWidth={1.5} className="shrink-0 text-green-primary" />
                ) : (
                  <span aria-hidden className="mx-px size-4 shrink-0 rounded-full border border-stroke-primary" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-medium", done ? "text-text-secondary" : "text-text-primary")}>{LESSONS[id].title}</span>
                  <span className="block truncate text-[12.5px] text-text-tertiary">{LESSONS[id].blurb}</span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-text-tertiary">{LESSONS[id].steps.length} steps</span>
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} className="shrink-0 text-text-tertiary" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
