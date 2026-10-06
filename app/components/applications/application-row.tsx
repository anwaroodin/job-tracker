import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { FlagMark } from "~/components/applications/flag-toggle";
import { NewBadge } from "~/components/ui/new-badge";
import { StatusBadge } from "~/components/ui/status-badge";
import { fmtDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { ApplicationRowData, SavedJobData } from "~/types/application";
import { SavedApplicationRowItem } from "~/components/applications/saved-application-row";

/**
 * Standard grid layout across tracked application list views:
 * Mobile: 2-column compact (Company & Role | Status & Date)
 * Desktop: 4-column (Company | Role | Status | Applied Date)
 */
export const APPLICATION_ROW_GRID_COLS =
  "grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_110px_110px]";

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

  return (
    <Link
      to={`/applications/${app.id}`}
      className={cn(
        "group grid min-h-[48px] items-center gap-x-3 gap-y-0.5 sm:gap-4 border-b border-stroke-secondary px-3 py-2 sm:py-2.5 transition-colors last:border-0 hover:bg-text-primary",
        app.unread && "shadow-[inset_2px_0_0_var(--color-green-primary)]",
        arrived && "arrive",
        gridCols,
        className
      )}
    >
      {/* Column 1: Company + Location */}
      <div className="min-w-0 col-start-1 row-start-1 sm:col-auto sm:row-auto">
        <div className="flex items-center gap-2 truncate">
          <CompanyLogo company={app.company} logoUrl={app.logoUrl} />
          {app.starred && <FlagMark status={app.status} />}
          <span
            title={app.company}
            className="truncate font-medium text-text-primary text-[13px] group-hover:!text-text-inverse"
          >
            {app.company}
          </span>
          {Boolean(app.unread) && <NewBadge count={app.unread} className="self-center" />}
        </div>
        {app.location && (
          <p
            title={app.location}
            className="mt-0.5 truncate text-[10.5px] text-text-tertiary group-hover:!text-text-inverse/60 hidden sm:block"
          >
            {app.location}
          </p>
        )}
      </div>

      {/* Column 2: Role (and mobile location) */}
      <div className="min-w-0 col-start-1 row-start-2 sm:col-auto sm:row-auto">
        <span
          title={app.role}
          className="block truncate font-sans text-[12px] sm:text-[12.5px] normal-case tracking-normal text-text-secondary group-hover:!text-text-inverse/85"
        >
          {app.role}
          {app.location && (
            <span className="text-[10px] text-text-tertiary group-hover:!text-text-inverse/60 sm:hidden">
              {" "}· {app.location}
            </span>
          )}
        </span>
      </div>

      {/* Column 3: Status Badge */}
      <div className="col-start-2 row-start-1 justify-self-end sm:col-auto sm:row-auto sm:justify-self-auto flex items-center">
        <StatusBadge status={app.status} className="group-hover:!text-text-inverse" />
      </div>

      {/* Column 4: Applied Date */}
      <div className="col-start-2 row-start-2 justify-self-end text-right sm:col-auto sm:row-auto sm:justify-self-auto">
        <span className="tabular-nums font-mono text-[10.5px] sm:text-[11px] text-text-secondary group-hover:!text-text-inverse/80">
          {app.appliedAt ? fmtDate(app.appliedAt) : "—"}
        </span>
      </div>
    </Link>
  );
}
