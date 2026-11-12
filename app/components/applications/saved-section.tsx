import { ApplicationRowItem } from "~/components/applications/application-row";
import { ListSection } from "~/components/applications/list-section";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { SAVED_APPLICATION_ROW_GRID_COLS } from "~/components/applications/saved-application-row";
import { cn } from "~/lib/cn";
import type { SavedJobData } from "~/types/application";

export function SavedSection({
  saved,
  isArrival,
}: {
  saved: SavedJobData[];
  isArrival: (id: string) => boolean;
}) {
  const savedCount = saved.length;
  return (
    <ListSection id="saved" title="Saved jobs" count={savedCount > 0 ? savedCount : undefined}>
      {savedCount === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-12 text-center font-sans normal-case tracking-normal">
          <p className="text-[14px] font-medium text-text-primary">No saved jobs</p>
          <p className="text-[13px] text-text-tertiary">Save postings with the browser extension and they'll wait here until you apply.</p>
        </div>
      ) : (
        <div className="font-sans normal-case tracking-normal">
          <div className={INSET_SEPARATORS}>
            {/* Header Row (Desktop only) */}
            <div
              className={cn(
                "hidden items-center gap-4 border-b border-stroke-secondary px-3 pb-2 text-[12px] font-medium text-text-tertiary sm:grid",
                SAVED_APPLICATION_ROW_GRID_COLS,
              )}
            >
              <span>Job</span>
              <span>Saved</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            {saved.map((job) => (
              <ApplicationRowItem
                key={job.id}
                variant="saved"
                job={job}
                arrived={isArrival(job.id)}
                confirmRemove
              />
            ))}
          </div>
        </div>
      )}
    </ListSection>
  );
}
