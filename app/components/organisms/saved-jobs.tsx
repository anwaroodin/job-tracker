import { Link, useFetcher } from "react-router";
import { Button } from "~/components/atoms/button";
import { FlagMark } from "~/components/molecules/flag";
import { fmtDate } from "~/components/molecules/terminal";
import { cn } from "~/lib/cn";
import type { Application } from "~/server/db/schema";

type SavedJob = Pick<Application, "id" | "company" | "role" | "url" | "location" | "starred" | "appliedAt">;

export function SavedJobs({ jobs }: { jobs: SavedJob[] }) {
  return (
    <ul className="divide-y divide-dashed divide-stroke-primary border-y border-stroke-secondary">
      {jobs.map((job) => (
        <SavedRow key={job.id} job={job} />
      ))}
    </ul>
  );
}

function SavedRow({ job }: { job: SavedJob }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const act = (intent: string) =>
    fetcher.submit({ intent, applicationId: job.id }, { method: "post" });

  return (
    <li className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", busy && "opacity-50")}>
      {/* Same hover as the records table, up to the saved date; the actions keep their own. */}
      <Link
        to={`/applications/${job.id}`}
        className="group flex min-w-0 flex-1 items-baseline gap-2 px-1 py-3 transition-colors hover:bg-text-primary focus-visible:bg-text-primary focus-visible:outline-none"
      >
        {job.starred && <FlagMark status="saved" />}
        {/* The company keeps its width (up to a cap) and the role gives way first. */}
        <span title={job.company} className="max-w-[40%] shrink-0 truncate text-text-primary group-hover:!text-text-inverse">
          {job.company}
        </span>
        <span
          title={job.role}
          className="min-w-0 truncate font-sans text-[13px] normal-case tracking-normal text-text-secondary group-hover:!text-text-inverse/80"
        >
          {job.role}
        </span>
        {job.location && (
          <span className="hidden truncate text-[11px] tracking-[0.08em] text-text-tertiary group-hover:!text-text-inverse/60 md:inline">
            {job.location}
          </span>
        )}
        <span className="ml-auto shrink-0 pl-4 text-[11px] tracking-[0.08em] text-text-tertiary group-hover:!text-text-inverse/60">
          Saved {fmtDate(job.appliedAt)}
        </span>
      </Link>
      <div className="flex items-center gap-1">
        {job.url && (
          <Button asChild variant="link" size="tiny">
            <a href={job.url} target="_blank" rel="noreferrer">
              Open posting ↗
            </a>
          </Button>
        )}
        <Button type="button" variant="ghost" size="tiny" disabled={busy} onClick={() => act("saved-applied")}>
          Mark applied
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="tiny"
          disabled={busy}
          onClick={() => act("saved-remove")}
          className="text-text-tertiary hover:text-red-primary"
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
