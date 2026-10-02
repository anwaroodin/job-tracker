import { ApplicationRowItem } from "~/components/applications/application-row";
import { SAVED_APPLICATION_ROW_GRID_COLS } from "~/components/applications/saved-application-row";
import { Section } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { SavedJobData } from "~/types/application";

export function SavedSection({ saved, isArrival }: { saved: SavedJobData[]; isArrival: (id: string) => boolean }) {
  const savedCount = saved.length;
  return (
    <Section
      n="02"
      title="Saved jobs"
      hint={savedCount > 0 ? `${savedCount} to apply` : undefined}
      i={1}
    >
      {savedCount === 0 ? (
        <div className="border border-dashed border-stroke-secondary px-4 py-8 text-center text-text-tertiary">
          <p className="text-[12px] font-mono">No saved jobs pending.</p>
          <p className="mt-1 font-sans text-[12px] text-text-tertiary/80 normal-case">
            Bookmark job postings using the Chrome extension or star them to follow up later.
          </p>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <div className="w-full min-w-0 sm:min-w-[640px]">
            {/* Header Row (Desktop only) */}
            <div
              className={cn(
                "hidden sm:grid items-center gap-4 border-b border-dashed border-white/15 px-3 pb-2.5 text-[10.5px] text-text-tertiary",
                SAVED_APPLICATION_ROW_GRID_COLS
              )}
            >
              <span>Company</span>
              <span>Role</span>
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
    </Section>
  );
}
