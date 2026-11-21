import { ArrowUpRight01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { fmtAgo } from "~/lib/format/time";
import { hostOf } from "~/lib/format/url";
import type { loader } from "~/routes/app/apply";

export type QueueJob = Awaited<ReturnType<typeof loader>>["jobs"][number];

const external = "flex shrink-0 items-center gap-1 text-[13px] font-medium text-text-primary hover:underline";

function Step({ done, onToggle, title, children, action }: { done: boolean; onToggle: () => void; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark "${title}" as not done` : `Mark "${title}" as done`}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors",
          done ? "border-green-primary bg-green-primary text-bg-primary" : "border-stroke-primary hover:border-text-tertiary",
        )}
      >
        {done && <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={2} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px] font-medium", done ? "text-text-tertiary" : "text-text-primary")}>{title}</p>
        <div className="text-[13px] leading-relaxed text-text-tertiary">{children}</div>
      </div>
      {action}
    </li>
  );
}

export function JobSteps({
  job,
  ticked,
  onToggle,
  onApplied,
  onSkip,
  onDrop,
}: {
  job: QueueJob;
  ticked: string[];
  onToggle: (step: string) => void;
  onApplied: () => void;
  onSkip: () => void;
  onDrop: () => void;
}) {
  const meta = [job.location, hostOf(job.url), `saved ${fmtAgo(job.savedAt)}`].filter(Boolean).join(" · ");
  const done = (step: string, auto = false) => auto || ticked.includes(step);
  const detail = `/applications/${job.id}`;

  return (
    <section className="flex flex-col border border-stroke-secondary">
      <div className="flex items-center gap-4 border-b border-stroke-secondary p-5">
        <CompanyLogo company={job.company} className="size-12 text-[18px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-medium text-text-primary">{job.role || "Untitled role"}</p>
          <p className="truncate text-[13.5px] text-text-tertiary" suppressHydrationWarning>
            {job.company} · {meta}
          </p>
        </div>
      </div>

      <ol className="flex flex-col divide-y divide-stroke-secondary px-5">
        <Step
          done={done("fit")}
          onToggle={() => onToggle("fit")}
          title="Check it's a good fit"
          action={
            job.url ? (
              <a href={job.url} target="_blank" rel="noreferrer" className={external}>
                Open listing <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
              </a>
            ) : undefined
          }
        >
          {job.fit ? (
            job.fit.count ? (
              <>
                It mentions <span className="font-medium text-text-secondary">{job.fit.count}</span> of the skills on your CV: {job.fit.matched.join(", ")}
                {job.fit.count > job.fit.matched.length ? "…" : "."}
              </>
            ) : (
              "It doesn't mention any skills from your CV. Read it closely before spending time on it."
            )
          ) : (
            "No description is saved for this job, so read the listing and decide if it's worth it."
          )}
        </Step>
        <Step
          done={done("cv", job.tailored)}
          onToggle={() => onToggle("cv")}
          title="Tailor your CV"
          action={
            <Link to={`${detail}/cv`} target="_blank" className={external}>
              {job.tailored ? "Open tailored CV" : "Tailor CV"} <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
            </Link>
          }
        >
          {job.tailored ? "Done. Check the changes read like you before sending it." : "Rewrites your CV around this job's keywords. It opens in a new tab, so this session stays here."}
        </Step>
        <Step done={done("letter", job.letter)} onToggle={() => onToggle("letter")} title="Write a cover letter">
          {job.letter ? "Written with your tailored CV." : job.tailored ? "Your tailored CV has no letter. Run tailoring again with the letter on, or skip this if they don't ask for one." : "Tailoring writes one for you. Skip this if they don't ask for one."}
        </Step>
        <Step
          done={done("people", job.people > 0)}
          onToggle={() => onToggle("people")}
          title="Find someone to message"
          action={
            <Link to={detail} target="_blank" className={external}>
              Find people <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
            </Link>
          }
        >
          {job.people ? `${job.people} ${job.people === 1 ? "person" : "people"} found. A short note to the recruiter after you apply helps you stand out.` : "A recruiter or hiring manager to message after you apply. Optional, but it gets more replies."}
        </Step>
      </ol>

      <div className="flex flex-wrap items-center gap-2 border-t border-stroke-secondary p-5">
        <Button type="button" onClick={onApplied} className="h-9 px-3.5 text-[13.5px]">
          I applied
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} className="h-9 px-3.5 text-[13.5px]">
          Skip for now
        </Button>
        <Button type="button" variant="ghost" onClick={onDrop} className="ml-auto h-9 px-3.5 text-[13.5px] text-text-tertiary">
          Not for me
        </Button>
      </div>
    </section>
  );
}
