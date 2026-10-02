import { useState, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { FlagMark } from "~/components/applications/flag-toggle";
import { fmtDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { SavedJobData } from "~/types/application";

/**
 * Standard grid layout for saved job application rows:
 * Mobile: compact 2-line layout with clean action buttons
 * Desktop: 4-column (Company | Role | Saved Date | Actions)
 */
export const SAVED_APPLICATION_ROW_GRID_COLS =
  "grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_90px_205px]";

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

/**
 * Saved job application row variant:
 * - Mobile (<sm): Compact, uncluttered card (~52px)
 *   Top: Company with bookmark mark + Role & Location
 *   Bottom: Saved Date on the left + Action buttons (Open, Apply, Remove) on the right
 * - Desktop (>=sm): 4-column terminal grid (`min-h-[48px] px-3 py-2.5`)
 */
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

  return (
    <div
      className={cn(
        "group relative border-b border-stroke-secondary px-3 py-2 sm:py-2.5 transition-colors last:border-0 hover:bg-text-primary",
        "flex flex-col gap-1 sm:grid sm:min-h-[48px] sm:items-center sm:gap-4",
        busy && "opacity-50",
        arrived && "arrive",
        gridCols,
        className
      )}
    >
      {/* Clickable link across Company, Role, Location, and Saved Date */}
      <Link
        to={`/applications/${job.id}`}
        className="group/link min-w-0 sm:col-span-3 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_90px] sm:items-center sm:gap-4 sm:-my-2.5 sm:py-2.5 sm:-ml-3 sm:pl-3 sm:pr-2"
      >
        {/* Company Column */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 truncate">
            <FlagMark status="saved" />
            <span
              title={job.company}
              className="truncate font-medium text-text-primary text-[13px] group-hover:!text-text-inverse"
            >
              {job.company}
            </span>
          </div>
          {job.location && (
            <p
              title={job.location}
              className="mt-0.5 truncate text-[10.5px] text-text-tertiary group-hover:!text-text-inverse/60 hidden sm:block"
            >
              {job.location}
            </p>
          )}
        </div>

        {/* Role Column */}
        <div className="min-w-0">
          <span
            title={job.role}
            className="block truncate font-sans text-[12px] sm:text-[12.5px] normal-case tracking-normal text-text-secondary group-hover:!text-text-inverse/85"
          >
            {job.role}
            {job.location && (
              <span className="text-[10px] text-text-tertiary group-hover:!text-text-inverse/60 sm:hidden">
                {" "}· {job.location}
              </span>
            )}
          </span>
        </div>

        {/* Saved Date Column */}
        <div className="hidden sm:block">
          <span className="tabular-nums font-mono text-[11px] text-text-tertiary group-hover:!text-text-inverse/70">
            {job.appliedAt ? fmtDate(job.appliedAt) : "—"}
          </span>
        </div>
      </Link>

      {/* Action Buttons Column (+ Mobile Date) */}
      <div className="flex items-center justify-between sm:justify-end gap-2 pt-0.5 sm:pt-0 shrink-0">
        {/* On mobile, show the Saved Date neatly next to the action buttons */}
        <span className="tabular-nums font-mono text-[10px] text-text-tertiary group-hover:!text-text-inverse/70 sm:hidden">
          Saved {job.appliedAt ? fmtDate(job.appliedAt) : "—"}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {actions ?? (
            <>
              {job.url && (
                <Button
                  asChild
                  variant="link"
                  size="tiny"
                  className="h-6 px-1.5 text-[10px] sm:h-6.5 sm:px-2 sm:text-[10.5px] group-hover:!text-text-inverse"
                >
                  <a href={job.url} target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="tiny"
                disabled={busy}
                onClick={handleApply}
                className="h-6 px-2 text-[10px] sm:h-6.5 sm:px-2 sm:text-[10.5px] border border-stroke-primary sm:border-0 group-hover:!text-text-inverse group-hover:!border-text-inverse/40"
              >
                {applyLabel}
              </Button>
              {confirmingRemove ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="tiny"
                    disabled={busy}
                    onClick={handleRemove}
                    className="h-6 px-1.5 text-[10px] sm:h-6.5 sm:px-2 sm:text-[10.5px]"
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="tiny"
                    disabled={busy}
                    onClick={() => setConfirmingRemove(false)}
                    className="h-6 px-1.5 text-[10px] sm:h-6.5 sm:px-1.5 sm:text-[10.5px]"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="tiny"
                  disabled={busy}
                  onClick={() => {
                    if (confirmRemove) {
                      setConfirmingRemove(true);
                    } else {
                      handleRemove();
                    }
                  }}
                  className="h-6 px-1.5 text-[10px] sm:h-6.5 sm:px-2 sm:text-[10.5px] text-text-tertiary hover:text-red-primary group-hover:!text-text-inverse/70 group-hover:hover:!text-red-primary"
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
