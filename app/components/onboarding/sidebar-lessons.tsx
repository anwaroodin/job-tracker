import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { cn } from "~/lib/cn";
import { onboarding$ } from "~/lib/state/onboarding";
import { LESSON_IDS, LESSONS } from "./lessons";
import { useLessons } from "./use-lessons";

export function SidebarLessons({ gmailConnected, collapsed }: { gmailConnected: boolean; collapsed: boolean }) {
  const { finished, count, total, show } = useLessons(gmailConnected);
  if (!show) return null;
  const next = LESSON_IDS.find((id) => !finished(id));

  if (collapsed) {
    return (
      <Link
        to={`?lesson=${next}`}
        preventScrollReset
        title={`Getting started · ${count} of ${total} done`}
        className="mx-auto mt-5 flex size-9 items-center justify-center text-[11px] font-semibold tabular-nums text-brand hover:bg-ink/[0.05]"
      >
        {count}/{total}
      </Link>
    );
  }

  return (
    <section className="mt-6 border border-stroke-secondary bg-sidebar-active p-3">
      <header className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-text-primary">Getting started</span>
        <button
          type="button"
          onClick={() => onboarding$.hidden.set(true)}
          className="-mr-1 cursor-pointer p-1 text-text-tertiary hover:bg-ink/[0.05] hover:text-text-primary"
          title="Hide"
          aria-label="Hide getting started"
        >
          <X className="size-3.5" />
        </button>
      </header>
      <p className="mt-0.5 text-[12px] text-text-tertiary">
        {count} of {total} done
      </p>
      <div aria-hidden className="mt-2.5 h-1.5 overflow-hidden bg-ink/[0.08]">
        <div className="h-full bg-brand transition-[width]" style={{ width: `${(count / total) * 100}%` }} />
      </div>
      <ol className="mt-2.5 flex flex-col">
        {LESSON_IDS.map((id) => (
          <li key={id}>
            <Link
              to={`?lesson=${id}`}
              preventScrollReset
              className={cn(
                "-mx-1.5 flex items-center gap-2 px-1.5 py-1.5 text-[13px] transition-colors hover:bg-ink/[0.05]",
                finished(id) ? "text-text-tertiary line-through decoration-ink/25" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {finished(id) ? (
                <Check className="size-3.5 shrink-0 text-green-primary" strokeWidth={2.5} />
              ) : (
                <span aria-hidden className={cn("size-3.5 shrink-0 rounded-full border", id === next ? "border-brand" : "border-stroke-primary")} />
              )}
              <span className="truncate">{LESSONS[id].title}</span>
              {id === next && (
                <motion.span
                  aria-hidden
                  className="ml-auto size-1.5 shrink-0 rounded-full bg-brand"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
