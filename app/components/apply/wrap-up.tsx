import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { BrandWord } from "~/components/shell/brand-word";
import { Button } from "~/components/ui/button";
import type { GoalProgress } from "~/lib/goal";
import { clearSession, sessionProgress, type ApplySessionState } from "~/lib/state/apply-session";

export function WrapUp({ session, progress }: { session: ApplySessionState; progress: GoalProgress | null }) {
  const { minutes } = sessionProgress(session, Date.now());
  const count = session.applied.length;
  const week = progress
    ? progress.hit
      ? `Weekly goal hit: ${progress.thisWeek} of ${progress.goal}.${progress.streak > 1 ? ` ${progress.streak} weeks in a row.` : ""}`
      : `${progress.thisWeek} of ${progress.goal} this week, ${progress.remaining} to go.`
    : null;

  return (
    <section className="flex flex-col gap-5 border border-stroke-secondary p-5 sm:p-6">
      {count > 0 && <BrandWord word="jobs" size={26} />}
      <div>
        <p className="text-[16px] font-medium text-text-primary">
          {count ? `You applied to ${count} ${count === 1 ? "job" : "jobs"} in ${Math.max(1, Math.round(minutes))} minutes.` : "No applications this time."}
        </p>
        <p className="mt-0.5 text-[13.5px] text-text-tertiary">
          {week ?? (count ? "Replies tend to come in within one to two weeks. They show up in your notifications." : "That's fine. Saving a few good jobs now makes the next session quicker.")}
        </p>
      </div>
      {count > 0 && (
        <ul className="flex flex-col">
          {session.applied.map((job) => (
            <li key={job.id} className="flex min-h-11 items-center gap-3 border-b border-stroke-secondary py-2 last:border-b-0">
              <CompanyLogo company={job.company} className="size-8 text-[13px]" />
              <Link to={`/applications/${job.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-text-primary">{job.company}</p>
                <p className="truncate text-[12.5px] text-text-tertiary">{job.role}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={clearSession} className="h-9 px-3.5 text-[13.5px]">
          Start another session
        </Button>
        <Button asChild variant="ghost" className="h-9 px-3.5 text-[13.5px]">
          <Link to="/overview" onClick={clearSession}>
            Back to overview
          </Link>
        </Button>
      </div>
    </section>
  );
}
