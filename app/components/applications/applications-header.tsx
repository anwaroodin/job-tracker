import { Link, useFetcher } from "react-router";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "~/components/ui/button";
import { NewApplication } from "~/components/applications/new-application";
import { stagger, PageTitle } from "~/components/ui/terminal";
import { SANS_PAGE } from "~/components/ui/page-section";
import { syncedAgo, useGmailStatus } from "~/lib/gmail-status";
import { useNow } from "~/hooks/use-now";
import { cn } from "~/lib/cn";
import type { GmailStatus, SyncResult } from "~/types/gmail";
import { WordTitle } from "~/components/shell/brand-word";

interface ApplicationsHeaderProps {
  total: number;
  activeCount: number;
  offersCount: number;
  closedCount: number;
  gmail: GmailStatus;
  stats?: boolean;
}

export function ApplicationsHeader({
  total,
  activeCount,
  offersCount,
  closedCount,
  gmail,
  stats = true,
}: ApplicationsHeaderProps) {
  const status = useGmailStatus(gmail);
  const fetcher = useFetcher<{ sync?: SyncResult }>();
  const syncing = fetcher.state !== "idle" || status.syncing;
  const ago = syncedAgo(status, useNow());
  const result = fetcher.state === "idle" ? fetcher.data?.sync : undefined;
  const error = result?.error ?? status.lastError;
  const syncCounts = status.lastFetched ? ` · ${status.lastFetched} new, ${status.lastLinked ?? 0} matched` : "";
  const syncLabel = syncing
    ? "Syncing Gmail…"
    : error
      ? error
      : result?.busy
        ? "Already syncing, check back in a minute"
        : ago
          ? `Synced ${ago}${syncCounts}`
          : "Gmail not synced yet";

  const heartbeat = (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          syncing ? "animate-ping bg-accent-primary" : error ? "bg-red-primary" : status.connected ? "bg-green-primary/80" : "bg-text-tertiary",
        )}
      />
      <span className={cn("truncate", error && "text-red-primary")}>{syncLabel}</span>
    </span>
  );

  const counts = [
    { label: "Active", value: activeCount },
    { label: "Offers", value: offersCount, tone: offersCount > 0 && "text-green-primary" },
    { label: "Closed", value: closedCount },
    { label: "Total", value: total },
  ];

  return (
    <header className={`rise flex flex-col gap-4 ${SANS_PAGE}`} style={stagger(0)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title={<WordTitle word="jobs" label="Applications" />} sub={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">{`${total} logged`}<span aria-hidden className="text-text-tertiary">·</span>{heartbeat}</span>} />
        <div className="flex items-center gap-3">
          {status.connected ? (
            <fetcher.Form method="post" className="shrink-0">
              <input type="hidden" name="intent" value="sync" />
              <Button type="submit" variant="secondary" size="medium" disabled={syncing}>
                <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.5} className={cn(syncing && "animate-spin text-accent-primary")} />
                {syncing ? "Syncing…" : "Sync Gmail"}
              </Button>
            </fetcher.Form>
          ) : (
            <Link to="/profile#integrations" className="text-[13.5px] text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              Connect Gmail
            </Link>
          )}
          <NewApplication />
        </div>
      </div>

      {stats && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y border-stroke-secondary py-2.5 text-[13.5px]">
          {counts.map((c) => (
            <div key={c.label} className="flex items-baseline gap-2">
              <dt className="text-text-tertiary">{c.label}</dt>
              <dd className={cn("font-medium tabular-nums text-text-primary", c.tone)}>{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
