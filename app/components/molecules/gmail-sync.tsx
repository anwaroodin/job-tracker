import { Link, useFetcher } from "react-router";
import { Button } from "~/components/atoms/button";
import { cn } from "~/lib/cn";
import { syncedAgo, useGmailStatus } from "~/lib/gmail-status";
import { useNow } from "~/lib/use-now";
import type { GmailStatus, SyncResult } from "~/server/gmail/sync.server";

// whatever route renders this needs to handle intent=sync in its action
export function GmailSync({ status: initial }: { status: GmailStatus }) {
  const status = useGmailStatus(initial);
  const fetcher = useFetcher<{ sync?: SyncResult }>();
  const syncing = fetcher.state !== "idle" || status.syncing;
  const ago = syncedAgo(status, useNow());
  const result = fetcher.state === "idle" ? fetcher.data?.sync : undefined;

  if (!status.connected) {
    return (
      <p className="text-[11px] tracking-[0.08em] text-text-tertiary">
        <Link to="/profile#integrations" className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
          Connect Gmail
        </Link>{" "}
        to pull in application emails
      </p>
    );
  }

  const error = result?.error ?? status.lastError;
  const counts = status.lastFetched ? ` · ${status.lastFetched} new, ${status.lastLinked ?? 0} matched` : "";
  const message = syncing
    ? "Syncing Gmail…"
    : result?.busy
      ? "Already syncing, check back in a minute"
      : status.hasMore
        ? "Catching up on older emails…"
        : ago
          ? `Synced ${ago}${counts}`
          : "Gmail not synced yet";

  const text = error ?? message;

  return (
    <div className="flex w-full items-center justify-between gap-4 sm:w-[26rem] sm:justify-end">
      <span
        title={text}
        aria-live="polite"
        suppressHydrationWarning
        className={cn(
          "min-w-0 truncate text-[11px] sm:text-right",
          error ? "normal-case text-red-primary" : "tracking-[0.08em] text-text-tertiary",
        )}
      >
        {text}
      </span>
      <fetcher.Form method="post" className="shrink-0">
        <input type="hidden" name="intent" value="sync" />
        <Button type="submit" variant="secondary" size="small" disabled={syncing} className="w-[7.5rem]">
          {syncing ? "Syncing…" : "Sync Gmail"}
        </Button>
      </fetcher.Form>
    </div>
  );
}
