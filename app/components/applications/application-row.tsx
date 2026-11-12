import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { FlagMark } from "~/components/applications/flag-toggle";
import { NewBadge } from "~/components/ui/new-badge";
import { StatusBadge } from "~/components/ui/status-badge";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { CLOSED_STATUSES } from "~/lib/status";
import type { ApplicationRowData, SavedJobData } from "~/types/application";
import { SavedApplicationRowItem } from "~/components/applications/saved-application-row";
import { TailorLink } from "~/components/applications/tailor-link";

export const APPLICATION_ROW_GRID_COLS = "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_48px_100px_164px]";

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string | number) => Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS));
const span = (days: number) =>
  days === 0 ? "today" : days < 14 ? `${days} ${days === 1 ? "day" : "days"}` : `${Math.round(days / 7)} weeks`;
const ago = (iso: string) => {
  const days = daysBetween(iso, Date.now());
  return days === 0 ? "Today" : `${span(days)} ago`;
};

export type ApplicationRowItemProps =
  | {
      variant?: "standard" | "application";
      app: ApplicationRowData;
      job?: never;
      arrived?: boolean;
      className?: string;
      gridCols?: string;
      onApply?: never;
      onRemove?: never;
      confirmRemove?: never;
      applyLabel?: never;
      actions?: never;
    }
  | {
      variant: "saved";
      app?: SavedJobData;
      job?: SavedJobData;
      arrived?: boolean;
      className?: string;
      gridCols?: string;
      onApply?: () => void;
      onRemove?: () => void;
      confirmRemove?: boolean;
      applyLabel?: string;
      actions?: React.ReactNode;
    }
  | {
      variant?: "saved";
      app?: never;
      job: SavedJobData;
      arrived?: boolean;
      className?: string;
      gridCols?: string;
      onApply?: () => void;
      onRemove?: () => void;
      confirmRemove?: boolean;
      applyLabel?: string;
      actions?: React.ReactNode;
    };

/**
 * Standard ApplicationRowItem component with variant & responsive support:
 * - variant="standard" (default): Tracked application with Status Badge and Applied Date
 * - variant="saved" (or job passed): Saved job posting with action buttons
 * - Mobile (<sm): 2-column layout (Company + Role on left, Status + Date on right)
 * - Desktop (>=sm): 4-column balanced ~48px row (`min-h-[48px] px-3 py-2.5`)
 * - Company with flag mark, unread indicator, and location
 * - High-contrast hover inverse transition
 */
export function ApplicationRowItem(props: ApplicationRowItemProps) {
  if (props.variant === "saved" || ("job" in props && props.job)) {
    const job = (props.job ?? props.app) as SavedJobData;
    return (
      <SavedApplicationRowItem
        job={job}
        arrived={props.arrived}
        className={props.className}
        gridCols={props.gridCols}
        onApply={"onApply" in props ? props.onApply : undefined}
        onRemove={"onRemove" in props ? props.onRemove : undefined}
        confirmRemove={"confirmRemove" in props ? props.confirmRemove : undefined}
        applyLabel={"applyLabel" in props ? props.applyLabel : undefined}
        actions={"actions" in props ? props.actions : undefined}
      />
    );
  }

  const { app, arrived = false, className, gridCols = APPLICATION_ROW_GRID_COLS } = props;
  const subtitle = [app.role, app.location, app.workType].filter(Boolean).join(" · ");
  const closed = CLOSED_STATUSES.includes(app.status);
  const statusNote = app.appliedAt
    ? closed
      ? `after ${span(daysBetween(app.appliedAt, app.updatedAt))}`
      : `updated ${ago(app.updatedAt).toLowerCase()}`
    : null;

  return (
    <div
      className={cn(
        "group relative grid min-h-14 items-center gap-x-4 px-3 py-2 font-sans text-[14px] normal-case tracking-normal transition-colors hover:bg-ink/[0.04]",
        app.unread && "bg-green-quaternary/40",
        arrived && "arrive",
        gridCols,
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CompanyLogo company={app.company} logoUrl={app.logoUrl} className="size-9 text-[14px]" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to={`/applications/${app.id}`}
              title={app.company}
              className="truncate font-medium text-text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-1 focus-visible:after:outline-text-secondary"
            >
              {app.company}
            </Link>
            {app.starred && <FlagMark status={app.status} />}
            {Boolean(app.unread) && <NewBadge count={app.unread} className="normal-case tracking-normal" />}
          </div>
          <p title={subtitle} className="truncate text-[12.5px] text-text-tertiary">
            {subtitle || "—"}
            {app.salary && <span className="text-green-primary"> · {app.salary}</span>}
          </p>
        </div>
      </div>

      <div className="hidden sm:block">
        {app.tailored ? <TailorLink id={app.id} tailored /> : <span aria-hidden className="text-[12.5px] text-text-tertiary">—</span>}
      </div>

      <div className="hidden text-[12.5px] tabular-nums sm:block">
        <p className="text-text-secondary">{app.appliedAt ? shortDate(app.appliedAt) : "—"}</p>
        {app.appliedAt && (
          <p className="text-text-tertiary" suppressHydrationWarning>
            {ago(app.appliedAt)}
          </p>
        )}
      </div>

      <div className="justify-self-end text-[12.5px] sm:justify-self-start">
        <StatusBadge status={app.status} variant="dot" className="font-medium text-text-primary" />
        {statusNote && (
          <p className="hidden whitespace-nowrap pl-3.5 text-text-tertiary sm:block" suppressHydrationWarning>
            {statusNote}
          </p>
        )}
      </div>
    </div>
  );
}
