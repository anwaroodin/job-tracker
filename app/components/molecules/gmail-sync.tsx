import { Link, useFetcher } from "react-router";
import { Button } from "~/components/atoms/button";
import type { GmailStatus, SyncResult } from "~/server/gmail/sync.server";

// whatever route renders this needs to handle intent=sync in its action
export function GmailSync({ status }: { status: GmailStatus }) {
  const fetcher = useFetcher<{ sync?: SyncResult }>();
  const syncing = fetcher.state !== "idle";
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

  const error = result?.error ?? (result ? null : status.lastError);
  const message = syncing
    ? "Syncing Gmail…"
    : result?.busy
      ? "Already syncing, check back in a minute"
      : result && !result.error
        ? `${result.fetched} new ${result.fetched === 1 ? "email" : "emails"}, ${result.linked} matched${result.more ? ". More to fetch" : ""}`
        : status.hasMore
          ? "Catching up on older emails…"
          : status.lastSynced
            ? `Gmail synced ${status.lastSynced}`
            : "Gmail not synced yet";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[11px] tracking-[0.08em] text-text-tertiary" aria-live="polite">
        {error ? <span className="text-red-primary normal-case tracking-normal">{error}</span> : message}
      </span>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="sync" />
        <Button type="submit" variant="secondary" size="small" disabled={syncing}>
          {syncing ? "Syncing…" : "Sync Gmail"}
        </Button>
      </fetcher.Form>
    </div>
  );
}
