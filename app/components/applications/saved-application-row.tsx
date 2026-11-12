import { useState, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { CompanyLogo } from "~/components/applications/company-logo";
import { FlagMark } from "~/components/applications/flag-toggle";
import { TailorLink } from "~/components/applications/tailor-link";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { SavedJobData } from "~/types/application";

export const SAVED_APPLICATION_ROW_GRID_COLS = "sm:grid-cols-[minmax(0,1fr)_80px_auto]";

export interface SavedApplicationRowItemProps {
  job: SavedJobData;
  arrived?: boolean;
  className?: string;
  gridCols?: string;
  onApply?: () => void;
  onRemove?: () => void;
  confirmRemove?: boolean;
  applyLabel?: string;
  actions?: React.ReactNode;
}

export function SavedApplicationRowItem({
  job,
  arrived = false,
  className,
  gridCols = SAVED_APPLICATION_ROW_GRID_COLS,
  onApply,
  onRemove,
  confirmRemove = false,
  applyLabel = "Apply",
  actions,
}: SavedApplicationRowItemProps) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    if (!confirmingRemove) return;
    const timer = setTimeout(() => setConfirmingRemove(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmingRemove]);

  const handleApply = () => {
    if (onApply) {
      onApply();
    } else {
      fetcher.submit({ intent: "saved-applied", applicationId: job.id }, { method: "post" });
    }
  };

  const handleRemove = () => {
    setConfirmingRemove(false);
    if (onRemove) {
      onRemove();
    } else {
      fetcher.submit({ intent: "saved-remove", applicationId: job.id }, { method: "post" });
    }
  };

  const subtitle = [job.role, job.location].filter(Boolean).join(" · ");
  const action = "h-7 px-2.5 font-sans text-[12.5px] font-medium normal-case tracking-normal";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 px-3 py-2 font-sans text-[14px] normal-case tracking-normal transition-colors hover:bg-ink/[0.04] sm:grid sm:min-h-14 sm:items-center sm:gap-4",
        busy && "opacity-50",
        arrived && "arrive",
        gridCols,
        className,
      )}
    >
      <Link to={`/applications/${job.id}`} className="flex min-w-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary">
        <CompanyLogo company={job.company} logoUrl={job.logoUrl} className="size-9 text-[14px]" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span title={job.company} className="truncate font-medium text-text-primary">
              {job.company}
            </span>
            <FlagMark status="saved" />
          </div>
          <p title={subtitle} className="truncate text-[12.5px] text-text-tertiary">
            {subtitle || "—"}
          </p>
        </div>
      </Link>

      <span className="hidden text-[12.5px] tabular-nums text-text-tertiary sm:block">
        {job.appliedAt ? shortDate(job.appliedAt) : "—"}
      </span>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="text-[12.5px] tabular-nums text-text-tertiary sm:hidden">
          Saved {job.appliedAt ? shortDate(job.appliedAt) : "—"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {actions ?? (
            <>
              <TailorLink id={job.id} tailored={job.tailored} className="px-2" />
              {job.url && (
                <Button asChild variant="ghost" size="tiny" className={action}>
                  <a href={job.url} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </Button>
              )}
              <Button type="button" variant="secondary" size="tiny" disabled={busy} onClick={handleApply} className={action}>
                {applyLabel}
              </Button>
              {confirmingRemove ? (
                <>
                  <Button type="button" variant="destructive" size="tiny" disabled={busy} onClick={handleRemove} className={action}>
                    Confirm
                  </Button>
                  <Button type="button" variant="ghost" size="tiny" disabled={busy} onClick={() => setConfirmingRemove(false)} className={action}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="tiny"
                  disabled={busy}
                  onClick={() => (confirmRemove ? setConfirmingRemove(true) : handleRemove())}
                  className={cn(action, "text-text-tertiary hover:text-red-primary")}
                >
                  Remove
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
