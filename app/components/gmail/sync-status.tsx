import { useEffect, useRef } from "react";
import { Link, useFetchers, useRevalidator } from "react-router";
import { cn } from "~/lib/cn";
import { refreshGmailStatus, syncedAgo, useGmailStatus } from "~/lib/gmail-status";
import { useNow } from "~/hooks/use-now";
import type { GmailStatus, SyncStage } from "~/types/gmail";

const SERVER_CLAIM_DELAY_MS = 1000;

const STAGES: { stage: SyncStage; label: string }[] = [
  { stage: "checking", label: "Checking inbox" },
  { stage: "downloading", label: "Downloading" },
  { stage: "classifying", label: "Classifying" },
  { stage: "reviewing", label: "Reading details" },
];

export function SyncStatus({ initial, collapsed }: { initial: GmailStatus; collapsed: boolean }) {
  const status = useGmailStatus(initial);
  const manualSyncRunning = useFetchers().some((f) => f.state !== "idle" && f.formData?.get("intent") === "sync");
  const syncing = status.syncing || manualSyncRunning;
  const ago = syncedAgo(status, useNow());

  useRefreshOnNewResults(status);
  useRefreshAroundManualSync(manualSyncRunning);

  const dot = <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotColour(status, syncing), syncing && "animate-pulse")} />;
  if (collapsed) {
    return (
      <span data-tour="sync" title={syncing ? "Syncing Gmail" : ago ? `Gmail synced ${ago}` : "Gmail"} className="flex h-8 items-center justify-center">
        {dot}
      </span>
    );
  }

  return (
    <div data-tour="sync" aria-live="polite" className="flex items-start gap-2.5 px-2.5 py-2 text-[12.5px] leading-snug">
      <span className="flex h-[18px] items-center">{dot}</span>
      <div className="min-w-0">{syncing ? <Syncing stage={status.stage} count={status.stageCount} /> : <Idle status={status} ago={ago} />}</div>
    </div>
  );
}

function Syncing({ stage, count }: { stage: SyncStage | null; count: number | null }) {
  const index = Math.max(0, STAGES.findIndex((s) => s.stage === stage));
  return (
    <>
      <p className="text-text-primary">
        {STAGES[index].label}
        {count ? ` ${count}` : ""}…
      </p>
      <p className="text-text-tertiary">
        Step {index + 1} of {STAGES.length}
      </p>
    </>
  );
}

function Idle({ status, ago }: { status: GmailStatus; ago: string | null }) {
  if (!status.connected) {
    return (
      <Link to="/profile#integrations" className="text-text-secondary transition-colors hover:text-text-primary">
        Connect Gmail
      </Link>
    );
  }
  if (status.needsReconnect) {
    return (
      <Link to="/profile#integrations" className="text-red-primary transition-colors hover:text-text-primary">
        Reconnect Gmail
      </Link>
    );
  }
  return (
    <>
      <p className="text-text-secondary" suppressHydrationWarning>
        {status.lastError ? "Gmail sync failed, retrying" : ago ? `Gmail synced ${ago}` : "Gmail not synced yet"}
      </p>
      {!!status.lastFetched && !status.lastError && (
        <p className="text-text-tertiary">
          {status.lastFetched} new · {status.lastLinked ?? 0} matched
        </p>
      )}
      {status.hasMore && <p className="text-text-tertiary">More to fetch</p>}
    </>
  );
}

function dotColour(status: GmailStatus, syncing: boolean) {
  if (syncing) return "bg-accent-primary";
  if (!status.connected) return "bg-text-tertiary";
  return status.lastError || status.needsReconnect ? "bg-red-primary" : "bg-green-primary";
}

function useRefreshOnNewResults(status: GmailStatus) {
  const revalidator = useRevalidator();
  const lastFinished = useRef(status.lastFinishedAt);
  useEffect(() => {
    const finishedAgain = status.lastFinishedAt !== null && status.lastFinishedAt !== lastFinished.current;
    if (finishedAgain) revalidator.revalidate();
    lastFinished.current = status.lastFinishedAt;
  }, [status.lastFinishedAt]);
}

function useRefreshAroundManualSync(running: boolean) {
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current === running) return;
    wasRunning.current = running;
    if (!running) return refreshGmailStatus();
    const timer = setTimeout(refreshGmailStatus, SERVER_CLAIM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [running]);
}
