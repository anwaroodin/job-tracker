import { Link } from "react-router";
import { fmtDate } from "~/components/ui/terminal";
import type { ApplicationRowData } from "~/types/application";

export function OffersBanner({ offersList, offersCount }: { offersList: ApplicationRowData[]; offersCount: number }) {
  return (
    <div className="relative overflow-hidden border border-green-primary/45 bg-green-primary/10 px-4 py-3 sm:px-5 sm:py-3.5">
      {/* Header row with status, counter, and action required notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-primary/25 pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-2 rounded-full bg-green-primary animate-pulse" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-green-primary">
            Offer Milestone
          </span>
          <span className="text-green-primary/40 font-mono">/</span>
          <span className="font-sans text-[12px] normal-case text-text-primary">
            {offersCount === 1
              ? "1 active offer received"
              : `${offersCount} active offers received`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-green-primary/90 font-medium">
            Action required
          </span>
        </div>
      </div>

      {/* Clean, high-density terminal offer rows */}
      <div className="divide-y divide-dashed divide-green-primary/25">
        {offersList.map((offer) => (
          <Link
            key={offer.id}
            to={`/applications/${offer.id}`}
            className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 transition-colors hover:bg-green-primary/10 -mx-2 px-2 rounded-xs"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono font-semibold text-[13.5px] text-text-primary group-hover:text-green-primary transition-colors">
                {offer.company}
              </span>
              <span className="truncate font-sans text-[12.5px] text-text-secondary normal-case">
                {offer.role}
              </span>
              {offer.salary && (
                <span className="font-mono text-[10.5px] font-medium text-green-primary bg-green-primary/15 border border-green-primary/30 px-1.5 py-0.5 rounded-xs">
                  {offer.salary}
                </span>
              )}
              {offer.location && (
                <span className="hidden font-mono text-[11px] text-text-tertiary sm:inline">
                  · {offer.location}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-[10.5px] text-text-tertiary">
                Received {fmtDate(offer.appliedAt)}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-green-primary font-medium group-hover:translate-x-0.5 transition-transform">
                <span>View offer</span>
                <span>→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
