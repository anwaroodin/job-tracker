import { Link, useFetcher } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { ListSection } from "~/components/applications/list-section";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { fmtAgo } from "~/lib/format/time";
import { STALE_SAVED_DAYS } from "~/lib/goal";
import type { loader } from "~/routes/app/overview";

type Review = NonNullable<Awaited<ReturnType<typeof loader>>["review"]>;

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("text-[22px] font-medium leading-none tabular-nums", value ? (tone ?? "text-text-primary") : "text-text-tertiary")}>{value}</span>
      <span className="text-[12.5px] text-text-tertiary">{label}</span>
    </div>
  );
}

function StaleJob({ job, now }: { job: Review["stale"][number]; now: number }) {
  const fetcher = useFetcher<{ ok?: boolean }>();
  if (fetcher.state !== "idle" || fetcher.data?.ok) return null;
  return (
    <li className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-ink/[0.04]">
      <CompanyLogo company={job.company} className="size-8 text-[13px]" />
      <Link to={`/applications/${job.id}`} className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{job.company}</p>
        <p className="truncate text-[12.5px] text-text-tertiary" suppressHydrationWarning>
          {[job.role, `saved ${fmtAgo(job.savedAt, now)}`].filter(Boolean).join(" · ")}
        </p>
      </Link>
      <fetcher.Form method="post" action="/applications?index">
        <input type="hidden" name="applicationId" value={job.id} />
        <Button type="submit" name="intent" value="saved-remove" variant="ghost" className="h-8 px-3 text-[13px] text-text-secondary">
          Drop
        </Button>
      </fetcher.Form>
    </li>
  );
}

export function WeeklyReview({ review }: { review: Review }) {
  const verdict = review.goal
    ? review.hit
      ? `You hit your goal: ${review.applied} of ${review.goal}.${review.streak > 1 ? ` That's ${review.streak} weeks in a row.` : ""}`
      : `You applied to ${review.applied} of ${review.goal}. A fresh week starts now.`
    : `You applied to ${review.applied} ${review.applied === 1 ? "job" : "jobs"}. Set a weekly goal to track your pace.`;
  const now = Date.now();

  return (
    <ListSection id="review" title="Last week">
      <div className="flex flex-col gap-5">
        <p className={cn("text-[14px]", review.hit ? "text-green-primary" : "text-text-secondary")}>{verdict}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Applied" value={review.applied} />
          <Stat label="Heard back" value={review.heardBack} />
          <Stat label="Interviews" value={review.interviews} tone="text-green-primary" />
          <Stat label="Offers" value={review.offers} tone="text-green-primary" />
        </div>

        {review.staleCount > 0 && (
          <div className="flex flex-col gap-2 border-t border-stroke-secondary pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13.5px] text-text-secondary">
                <span className="font-medium text-text-primary">{review.staleCount}</span> saved {review.staleCount === 1 ? "job has" : "jobs have"} waited over {STALE_SAVED_DAYS} days. Apply or drop them.
              </p>
              <Link to="/apply" className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary">
                Start an apply session
              </Link>
            </div>
            <ul className={cn("-mx-3 flex flex-col", INSET_SEPARATORS)}>
              {review.stale.map((job) => (
                <StaleJob key={job.id} job={job} now={now} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </ListSection>
  );
}
