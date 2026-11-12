import { GmailSync } from "~/components/gmail/gmail-sync";
import { ApplicationRowItem, APPLICATION_ROW_GRID_COLS } from "~/components/applications/application-row";
import { NewApplication } from "~/components/applications/new-application";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import type { GmailStatus } from "~/types/gmail";
import { PAGE_SIZE, type ApplicationsView, type SortKey } from "./use-applications-view";

export function ApplicationsTable({
  view,
  gmail,
  isArrival,
}: {
  view: ApplicationsView;
  gmail: GmailStatus;
  isArrival: (id: string) => boolean;
}) {
  const { total, sortCol, sortDir, handleSortToggle, paginatedItems, resetAllFilters, totalPages, currentPage, filteredItems, setPage } =
    view;
  const header = (key: SortKey, label: string, className?: string) => (
    <button
      type="button"
      onClick={() => handleSortToggle(key)}
      className={cn("inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text-primary", sortCol === key && "text-text-secondary", className)}
    >
      {label}
      {sortCol === key && <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  return (
    <div className="font-sans text-[14px] normal-case tracking-normal">
      <div className={cn("hidden items-center gap-x-4 border-b border-stroke-secondary px-3 pb-2 text-[12px] font-medium text-text-tertiary sm:grid", APPLICATION_ROW_GRID_COLS)}>
        {header("company", "Job")}
        <span>CV</span>
        {header("appliedAt", "Applied")}
        {header("status", "Status")}
      </div>

      {paginatedItems.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
          {total === 0 ? (
            <>
              <p className="font-medium text-text-primary">No applications yet</p>
              <p className="max-w-md text-[13px] text-text-tertiary">Add one by hand, or sync Gmail and they'll fill in from your inbox.</p>
              <div className="mt-3 flex items-center gap-3">
                <NewApplication />
                <GmailSync status={gmail} />
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-text-primary">Nothing matches these filters</p>
              <p className="text-[13px] text-text-tertiary">Try a different search, or clear the filters.</p>
              <Button type="button" variant="secondary" size="small" onClick={resetAllFilters} className="mt-2 font-sans normal-case tracking-normal">
                Clear filters
              </Button>
            </>
          )}
        </div>
      )}

      <div className={cn("flex flex-col py-1", INSET_SEPARATORS)}>
        {paginatedItems.map((app) => (
          <ApplicationRowItem key={app.id} app={app} arrived={isArrival(app.id)} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke-secondary px-3 pt-3 text-[13px] text-text-tertiary">
          <span>
            {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="font-sans normal-case tracking-normal"
            >
              Previous
            </Button>
            <span className="px-2">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="font-sans normal-case tracking-normal"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const INSET_SEPARATORS =
  "[&>*+*]:before:absolute [&>*+*]:before:left-[60px] [&>*+*]:before:right-0 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-stroke-secondary";
