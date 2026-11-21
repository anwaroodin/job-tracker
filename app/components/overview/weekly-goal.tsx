import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { FireIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ListSection } from "~/components/applications/list-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { GOAL_PRESETS, MAX_WEEKLY_GOAL, type GoalProgress } from "~/lib/goal";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function GoalForm({ current, onDone }: { current: number | null; onDone?: () => void }) {
  const fetcher = useFetcher();
  const [custom, setCustom] = useState(current ? String(current) : "");
  const save = (goal: number | "") => {
    fetcher.submit({ intent: "set-goal", goal: String(goal) }, { method: "post" });
    onDone?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {GOAL_PRESETS.map((n) => (
        <Button
          key={n}
          type="button"
          variant="secondary"
          onClick={() => save(n)}
          className={cn("h-8 px-3 text-[13px] font-medium", n === current ? "border-stroke-primary bg-ink/[0.07]" : "border-stroke-secondary bg-bg-primary hover:border-stroke-primary hover:bg-bg-primary")}
        >
          {n} a week
        </Button>
      ))}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (Number(custom) >= 1) save(Number(custom));
        }}
      >
        <Input type="number" min={1} max={MAX_WEEKLY_GOAL} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Other" aria-label="Applications a week" className="h-8 w-20 text-[13px]" />
        <Button type="submit" variant="ghost" className="h-8 px-3 text-[13px]">
          Set
        </Button>
      </form>
      {current && (
        <Button type="button" variant="ghost" onClick={() => save("")} className="h-8 px-3 text-[13px] text-text-tertiary">
          Remove goal
        </Button>
      )}
    </div>
  );
}

function message(p: GoalProgress) {
  if (p.hit) return { tone: "text-green-primary", text: p.thisWeek > p.goal ? `Goal hit, and ${p.thisWeek - p.goal} extra. Anything more is a bonus.` : "Goal hit for this week. Nice work." };
  const pace = p.daysLeft === 1 ? `${plural(p.remaining, "more")} today to hit it.` : `${plural(p.remaining, "more")} in ${p.daysLeft} days, about ${p.perDay} a day.`;
  if (p.onTrack) return { tone: "text-text-secondary", text: `On track. ${pace}` };
  return { tone: "text-accent-primary", text: `Behind pace. ${pace}${p.streak ? ` Keep your ${plural(p.streak, "week")} streak alive.` : ""}` };
}

export function WeeklyGoal({ progress, goal }: { progress: GoalProgress | null; goal: number | null }) {
  const [editing, setEditing] = useState(false);

  if (!progress || editing) {
    return (
      <ListSection title="Weekly goal">
        <div className="flex flex-col gap-3 border border-stroke-secondary px-4 py-4">
          <div>
            <p className="font-medium text-text-primary">{goal ? "Change your weekly goal" : "How many jobs will you apply to each week?"}</p>
            <p className="text-[13px] text-text-tertiary">A small number you can keep up beats a big one you drop. Weeks run Monday to Sunday.</p>
          </div>
          <GoalForm current={goal} onDone={() => setEditing(false)} />
        </div>
      </ListSection>
    );
  }

  const say = message(progress);
  return (
    <ListSection
      title="This week"
      count={`${progress.thisWeek} of ${progress.goal}`}
      actions={
        <Button type="button" variant="ghost" onClick={() => setEditing(true)} className="h-8 px-3 text-[13px] text-text-secondary">
          Change goal
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-1" role="img" aria-label={`${progress.thisWeek} of ${progress.goal} applications this week`}>
          {Array.from({ length: Math.max(progress.goal, progress.thisWeek) }, (_, i) => (
            <span key={i} className={cn("h-2 flex-1", i < progress.thisWeek ? (progress.hit ? "bg-green-primary" : "bg-text-primary") : "bg-ink/[0.08]")} />
          ))}
        </div>
        <p className={cn("text-[14px]", say.tone)}>{say.text}</p>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-stroke-secondary pt-4">
          <p className="flex items-center gap-2 text-[13.5px] text-text-secondary">
            <HugeiconsIcon icon={FireIcon} size={16} strokeWidth={1.5} className={progress.streak ? "text-accent-primary" : "text-text-tertiary"} />
            {progress.streak ? (
              <span>
                <span className="font-medium tabular-nums text-text-primary">{progress.streakAtLimit ? `${progress.streak}+` : progress.streak}</span> {progress.streak === 1 ? "week" : "weeks"} in a row
              </span>
            ) : (
              <span>Hit this week's goal to start a streak</span>
            )}
          </p>
          <ol className="flex items-center gap-1.5" aria-label="Recent weeks">
            {progress.history.map((week, i) => {
              const current = i === progress.history.length - 1;
              return (
                <li
                  key={week.weekStart}
                  title={`Week of ${shortDate(week.weekStart)}: ${week.count} of ${progress.goal}`}
                  className={cn("size-2.5 rounded-full", week.hit ? "bg-green-primary" : current ? "border border-text-tertiary" : "bg-ink/[0.12]")}
                />
              );
            })}
          </ol>
        </div>

        {!progress.hit && (
          <Button asChild className="h-9 self-start px-3.5 text-[13.5px]">
            <Link to="/apply">Start an apply session</Link>
          </Button>
        )}
      </div>
    </ListSection>
  );
}
