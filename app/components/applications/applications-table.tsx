import { GmailSync } from "~/components/gmail/gmail-sync";
import { ApplicationRowItem, APPLICATION_ROW_GRID_COLS } from "~/components/applications/application-row";
import { NewApplication } from "~/components/applications/new-application";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import type { GmailStatus } from "~/types/gmail";
import { PAGE_SIZE, type ApplicationsView, type SortDir, type SortKey } from "./use-applications-view";

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
  return (
    <>
      {/* Table Container */}
      <div className="-mx-1 overflow-x-auto">
        <div className="w-full min-w-0 sm:min-w-[640px]">
          {/* Header Row with Sortable Columns (Desktop only) */}
          <div
            className={cn(
              "hidden sm:grid items-center gap-4 border-b border-dashed border-white/15 px-3 pb-2.5 text-[10.5px] text-text-tertiary",
              APPLICATION_ROW_GRID_COLS
            )}
          >
            <button
              type="button"
              onClick={() => handleSortToggle("company")}
              className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary text-left cursor-pointer"
            >
              <span>Company</span>
              <SortIndicator column="company" current={sortCol} dir={sortDir} />
            </button>

            <button
              type="button"
              onClick={() => handleSortToggle("role")}
              className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary text-left cursor-pointer"
            >
              <span>Role</span>
              <SortIndicator column="role" current={sortCol} dir={sortDir} />
            </button>

            <button
              type="button"
              onClick={() => handleSortToggle("status")}
              className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary text-left cursor-pointer"
            >
              <span>Status</span>
              <SortIndicator column="status" current={sortCol} dir={sortDir} />
            </button>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleSortToggle("appliedAt")}
                className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary cursor-pointer"
              >
                <span>Applied</span>
                <SortIndicator column="appliedAt" current={sortCol} dir={sortDir} />
              </button>
            </div>
          </div>

          {/* Empty States */}
          {paginatedItems.length === 0 && (
            <div className="border border-dashed border-stroke-primary py-12 text-center text-text-tertiary px-4">
              {total === 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[13px] text-text-primary">No applications logged yet.</p>
                  <p className="max-w-md font-sans text-[12px] normal-case tracking-normal text-text-secondary">
                    Start tracking your job search by adding an application manually or syncing directly with Gmail.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <NewApplication />
                    <GmailSync status={gmail} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[13px] text-text-primary">
                    No applications match your filter criteria.
                  </p>
                  <p className="font-sans text-[12px] normal-case tracking-normal text-text-secondary">
                    Try adjusting your search terms or clearing your current filters.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="small"
                    onClick={resetAllFilters}
                    className="mt-1"
                  >
                    Reset filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Rows */}
          {paginatedItems.map((app) => (
            <ApplicationRowItem
              key={app.id}
              app={app}
              arrived={isArrival(app.id)}
            />
          ))}
        </div>
      </div>

      {/* Minimal Terminal Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-white/15 pt-4 text-[11px] text-text-tertiary">
          <span>
            Showing {currentPage * PAGE_SIZE + 1}–
            {Math.min((currentPage + 1) * PAGE_SIZE, filteredItems.length)} of{" "}
            {filteredItems.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="border border-stroke-primary px-2.5 py-1 text-text-secondary transition-colors hover:bg-fill-primary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              ← Prev
            </button>
            <span className="px-2 font-mono">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="border border-stroke-primary px-2.5 py-1 text-text-secondary transition-colors hover:bg-fill-primary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SortIndicator({
  column,
  current,
  dir,
}: {
  column: SortKey;
  current: SortKey;
  dir: SortDir;
}) {
  if (column !== current) {
    return <span className="text-[9px] opacity-30">◆</span>;
  }
  return <span className="text-[9px] text-text-primary">{dir === "asc" ? "▲" : "▼"}</span>;
}
