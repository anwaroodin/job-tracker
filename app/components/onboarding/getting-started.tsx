import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Section, two } from "~/components/ui/terminal";
import { onboarding$ } from "~/lib/state/onboarding";
import { LESSON_IDS, LESSONS } from "./lessons";
import { useLessons } from "./use-lessons";

export function GettingStarted({ n, gmailConnected }: { n: string; gmailConnected: boolean }) {
  const { finished, count, total, show } = useLessons(gmailConnected);
  if (!show) return null;

  return (
    <Section n={n} id="getting-started" title="Getting started" hint={`${count}/${total} done`} i={1} className="lg:hidden">
      {LESSON_IDS.map((id) => (
        <Link
          key={id}
          to={`?lesson=${id}`}
          preventScrollReset
          className="group flex items-baseline gap-3 border-b border-dashed border-white/10 px-1 py-2.5 transition-colors hover:bg-text-primary hover:text-text-inverse"
        >
          <span className={finished(id) ? "text-green-primary group-hover:text-text-inverse" : "text-text-tertiary group-hover:text-text-inverse/70"}>
            [{finished(id) ? "✓" : " "}]
          </span>
          <span className="text-text-primary group-hover:text-text-inverse">{LESSONS[id].title}</span>
          <span className="hidden font-sans text-[12px] normal-case tracking-normal text-text-tertiary group-hover:text-text-inverse/70 sm:inline">
            {LESSONS[id].blurb}
          </span>
          <span className="ml-auto text-text-tertiary group-hover:text-text-inverse/70">
            {two(LESSONS[id].steps.length)} steps ▸
          </span>
        </Link>
      ))}
      <div className="flex justify-end pt-3">
        <Button type="button" variant="ghost" size="tiny" onClick={() => onboarding$.hidden.set(true)}>
          Hide
        </Button>
      </div>
    </Section>
  );
}
