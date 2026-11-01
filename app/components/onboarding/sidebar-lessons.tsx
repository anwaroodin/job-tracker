import { X } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { cn } from "~/lib/cn";
import { onboarding$ } from "~/lib/state/onboarding";
import { LESSON_IDS, LESSONS } from "./lessons";
import { useLessons } from "./use-lessons";

const CELLS = 16;

export function SidebarLessons({ gmailConnected, collapsed }: { gmailConnected: boolean; collapsed: boolean }) {
  const { finished, count, total, show } = useLessons(gmailConnected);
  if (!show) return null;
  const next = LESSON_IDS.find((id) => !finished(id));
  const filled = Math.round((count / total) * CELLS);

  if (collapsed) {
    return (
      <Link
        to={`?lesson=${next}`}
        preventScrollReset
        title={`Getting started · ${count}/${total} done`}
        className="mx-auto mt-6 flex size-8 items-center justify-center font-mono text-[10px] tabular-nums text-text-accent hover:bg-fill-tertiary"
      >
        {count}/{total}
      </Link>
    );
  }

  return (
    <section className="mt-7 border-t border-dashed border-white/15 px-2.5 pt-3 font-mono text-[10.5px] uppercase tracking-[0.08em]">
      <header className="flex items-center justify-between pb-2">
        <span className="eyebrow !text-[10px]">Getting started</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-text-accent">
            {count}/{total}
          </span>
          <button
            type="button"
            onClick={() => onboarding$.hidden.set(true)}
            className="cursor-pointer text-text-tertiary hover:text-text-primary"
            title="Hide lessons"
            aria-label="Hide lessons"
          >
            <X className="size-3" />
          </button>
        </span>
      </header>
      <p aria-hidden className="pb-2 tracking-[0.02em] text-text-tertiary">
        <span className="text-text-accent">{"█".repeat(filled)}</span>
        {"░".repeat(CELLS - filled)}
      </p>
      <ol className="flex flex-col">
        {LESSON_IDS.map((id) => (
          <li key={id}>
            <Link
              to={`?lesson=${id}`}
              preventScrollReset
              className={cn(
                "-mx-1 flex items-center gap-2 px-1 py-[5px] transition-colors hover:bg-fill-tertiary hover:text-text-primary",
                finished(id) ? "text-text-tertiary line-through decoration-white/20" : "text-[#c9c9cd]",
              )}
            >
              <span className={cn("shrink-0 whitespace-pre", finished(id) ? "text-green-primary" : "text-text-tertiary")}>
                [{finished(id) ? "✓" : " "}]
              </span>
              <span className="truncate">{LESSONS[id].title}</span>
              {id === next && (
                <motion.span
                  aria-hidden
                  className="ml-auto size-1.5 shrink-0 rounded-full bg-accent-primary"
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
