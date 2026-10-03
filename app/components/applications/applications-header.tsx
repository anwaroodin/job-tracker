import { Link, useFetcher } from "react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { NewApplication } from "~/components/applications/new-application";
import { stagger, two } from "~/components/ui/terminal";
import { syncedAgo, useGmailStatus } from "~/lib/gmail-status";
import { useNow } from "~/hooks/use-now";
import { cn } from "~/lib/cn";
import type { GmailStatus, SyncResult } from "~/types/gmail";

interface ApplicationsHeaderProps {
  total: number;
  activeCount: number;
  offersCount: number;
  closedCount: number;
  gmail: GmailStatus;
}

export function ApplicationsHeader({
  total,
  activeCount,
  offersCount,
  closedCount,
  gmail,
}: ApplicationsHeaderProps) {
  const status = useGmailStatus(gmail);
  const fetcher = useFetcher<{ sync?: SyncResult }>();
  const syncing = fetcher.state !== "idle" || status.syncing;
  const ago = syncedAgo(status, useNow());
  const result = fetcher.state === "idle" ? fetcher.data?.sync : undefined;
  const error = result?.error ?? status.lastError;
  const counts = status.lastFetched ? ` · ${status.lastFetched} new, ${status.lastLinked ?? 0} matched` : "";
  const syncLabel = syncing
    ? "Syncing Gmail…"
    : error
      ? error
      : ago
        ? `Synced ${ago}${counts}`
        : "Gmail not synced yet";

  return (
    <header className="rise flex flex-col gap-4" style={stagger(0)}>
      {/* Top row: Title + Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[01]</b>
            Applications
          </p>
          <h1 className="mt-2 text-[24px] sm:text-[30px] font-light leading-tight tracking-tight text-text-primary">
            {total} applications logged
          </h1>
        </div>

        {/* Action cluster: primary creation + secondary sync trigger */}
        <div className="flex items-center gap-3">
          {status.connected ? (
            <fetcher.Form method="post" className="shrink-0">
              <input type="hidden" name="intent" value="sync" />
              <Button
                type="submit"
                variant="secondary"
                size="small"
                disabled={syncing}
                className="h-9 px-3 text-[11px]"
              >
                <RefreshCw className={cn("size-3", syncing && "animate-spin text-accent-primary")} />
                <span>{syncing ? "Syncing…" : "Sync Gmail"}</span>
              </Button>
            </fetcher.Form>
          ) : (
            <p className="text-[11px] tracking-[0.08em] text-text-tertiary">
              <Link
                to="/profile#integrations"
                className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
              >
                Connect Gmail
              </Link>
            </p>
          )}
          <NewApplication />
        </div>
      </div>

      {/* Ticker bar: Telemetry metrics + docked live sync heartbeat */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-dashed border-white/15 py-2.5 text-[11px] tracking-[0.06em]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">ACTIVE</span>
            <span className="font-semibold text-text-primary tabular-nums">{two(activeCount)}</span>
          </div>

          <span className="text-white/15">|</span>

          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">OFFERS</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                offersCount > 0 ? "text-green-primary" : "text-text-primary",
              )}
            >
              {two(offersCount)}
            </span>
          </div>

          <span className="text-white/15">|</span>

          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">CLOSED</span>
            <span className="font-semibold text-text-secondary tabular-nums">{two(closedCount)}</span>
          </div>

          <span className="text-white/15">|</span>

          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">TOTAL</span>
            <span className="font-semibold text-text-primary tabular-nums">{two(total)}</span>
          </div>
        </div>

        {/* Sync heartbeat docked on right side */}
        <div className="flex items-center gap-2 text-[10.5px] tracking-[0.06em] text-text-tertiary">
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0",
              syncing
                ? "bg-accent-primary animate-ping"
                : error
                  ? "bg-red-primary"
                  : status.connected
                    ? "bg-green-primary/80"
                    : "bg-text-tertiary",
            )}
          />
          <span className={cn("truncate", error ? "text-red-primary normal-case" : "text-text-tertiary")}>
            {syncLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
