import { useSelector } from "@legendapp/state/react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Button } from "~/components/ui/button";
import { SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock, SideRow } from "~/components/ui/side-block";
import { PageTitle, stagger } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import {
  applySession$,
  endSession,
  sessionProgress,
  settleJob,
  skipJob,
  targetLabel,
  toggleStep,
  type ApplySessionState,
} from "~/lib/state/apply-session";
import type { loader } from "~/routes/app/apply";
import { FindJobs, SearchLinks } from "./find-jobs";
import { StartSession } from "./start";
import { JobSteps, type QueueJob } from "./steps";
import { WrapUp } from "./wrap-up";

type Data = Awaited<ReturnType<typeof loader>>;

const UP_NEXT = 4;
const SAVE_INTENTS = { applied: "saved-applied", dropped: "saved-remove" } as const;

const clock = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function orderQueue(jobs: QueueJob[], session: ApplySessionState) {
  const settled = new Set([...session.applied.map((job) => job.id), ...session.dropped]);
  const open = jobs.filter((job) => !settled.has(job.id));
  const skipped = (job: QueueJob) => job.id in session.skippedAt;
  return [...open.filter((job) => !skipped(job)), ...open.filter(skipped).sort((a, b) => session.skippedAt[a.id] - session.skippedAt[b.id])];
}

function SessionBar({ session, now }: { session: ApplySessionState; now: number }) {
  const { minutes, share, reached } = sessionProgress(session, now);
  const t = session.target;
  const status = t.kind === "count" ? `${session.applied.length} of ${t.value} applied` : `${clock(t.value - minutes)} left`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-3 text-[13.5px]">
        <span className={cn("font-medium tabular-nums", reached ? "text-green-primary" : "text-text-primary")}>{reached ? `Target reached: ${targetLabel(t)}` : status}</span>
        <span className="tabular-nums text-text-tertiary">
          {t.kind === "count" ? `${clock(minutes)} in` : `${session.applied.length} applied`}
          <Button type="button" variant="ghost" onClick={endSession} className="ml-3 h-8 px-3 text-[13px]">
            {reached ? "Wrap up" : "End session"}
          </Button>
        </span>
      </div>
      <div className="h-1 w-full bg-ink/[0.07]">
        <div className={cn("h-full transition-[width] duration-500", reached ? "bg-green-primary" : "bg-text-primary")} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

function withOutsideApplies(session: ApplySessionState | null, recentlyApplied: Data["recentlyApplied"]): ApplySessionState | null {
  if (!session) return null;
  const known = new Set([...session.applied.map((job) => job.id), ...session.dropped]);
  const end = session.endedAt ?? Infinity;
  const outside = recentlyApplied
    .filter((app) => !known.has(app.id) && Date.parse(app.appliedAt) >= session.startedAt && Date.parse(app.appliedAt) <= end)
    .map(({ id, company, role }) => ({ id, company, role }));
  return outside.length ? { ...session, applied: [...session.applied, ...outside] } : session;
}

export function ApplySession({ jobs, searches, thisWeek, progress, recentlyApplied }: Data) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const stored = useSelector(() => applySession$.session.get());
  const session = withOutsideApplies(stored, recentlyApplied);
  const now = useNow(Boolean(session && !session.endedAt));
  const fetcher = useFetcher();

  const queue = session ? orderQueue(jobs, session) : jobs;
  const current = queue[0];
  const notYetCounted = session ? session.applied.filter((applied) => jobs.some((job) => job.id === applied.id)).length : 0;
  const weekCount = thisWeek + notYetCounted;
  const left = progress ? Math.max(0, progress.goal - weekCount) : null;

  const settle = (job: QueueJob, outcome: keyof typeof SAVE_INTENTS) => {
    fetcher.submit({ intent: SAVE_INTENTS[outcome], applicationId: job.id }, { method: "post", action: "/applications?index" });
    settleJob({ id: job.id, company: job.company, role: job.role }, outcome);
  };

  const main = !mounted ? null : !session ? (
    <StartSession queued={jobs.length} left={left} />
  ) : session.endedAt ? (
    <WrapUp session={session} progress={progress} />
  ) : (
    <>
      <SessionBar session={session} now={now} />
      {current ? (
        <JobSteps
          key={current.id}
          job={current}
          ticked={session.ticked[current.id] ?? []}
          onToggle={(step) => toggleStep(current.id, step)}
          onApplied={() => settle(current, "applied")}
          onSkip={() => skipJob(current.id)}
          onDrop={() => settle(current, "dropped")}
        />
      ) : null}
      <FindJobs searches={searches} empty={!current} />
    </>
  );

  return (
    <div className={cn("flex flex-col gap-8", SANS_PAGE)}>
      <header className="rise" style={stagger(0)}>
        <PageTitle title="Apply session" sub="Find jobs, tailor your CV, apply. One job at a time." />
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="rise flex min-w-0 flex-col gap-6" style={stagger(1)}>
          {main}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">
          <SideBlock title="This week" aside={progress ? `goal ${progress.goal}` : undefined}>
            <SideRow label="Applied" value={weekCount} />
            {left !== null && <SideRow label="Left to hit your goal" value={left} />}
            {progress && progress.streak > 0 && <SideRow label="Weeks in a row" value={progress.streak} />}
          </SideBlock>
          {queue.length > 1 && (
            <SideBlock title="Up next" aside={queue.length - 1}>
              {queue.slice(1, UP_NEXT + 1).map((job) => (
                <SideRow key={job.id} lead={<CompanyLogo company={job.company} className="size-6 text-[11px]" />} label={job.company} value={null} />
              ))}
            </SideBlock>
          )}
          <SideBlock title="Search for jobs">
            <SearchLinks searches={searches} />
          </SideBlock>
        </aside>
      </div>
    </div>
  );
}
