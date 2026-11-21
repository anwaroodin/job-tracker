import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { SESSION_TARGETS, startSession, targetLabel } from "~/lib/state/apply-session";

export function StartSession({ queued, left }: { queued: number; left: number | null }) {
  return (
    <section className="flex flex-col gap-5 border border-stroke-secondary p-5 sm:p-6">
      <div>
        <p className="text-[16px] font-medium text-text-primary">What's the plan for this session?</p>
        <p className="mt-0.5 text-[13.5px] text-text-tertiary">
          {queued ? `${queued} saved ${queued === 1 ? "job is" : "jobs are"} waiting.` : "Your queue is empty, so the session starts by finding jobs."}
          {left ? ` ${left} more this week hits your goal.` : ""} Pick something you can finish now.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SESSION_TARGETS.map((target) => (
          <Button
            key={targetLabel(target)}
            type="button"
            variant="secondary"
            onClick={() => startSession(target)}
            className={cn(
              "h-16 flex-col items-start justify-center gap-0.5 border-stroke-secondary bg-bg-primary px-4 text-left hover:border-stroke-primary hover:bg-ink/[0.04]",
            )}
          >
            <span className="text-[15px] font-medium text-text-primary">{target.kind === "count" ? target.value : `${target.value} min`}</span>
            <span className="text-[12.5px] font-normal text-text-tertiary">{target.kind === "count" ? "applications" : "of focused applying"}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}
