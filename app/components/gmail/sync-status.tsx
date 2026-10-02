import { useEffect, useRef } from "react";
import { Link, useFetchers, useRevalidator } from "react-router";
import { cn } from "~/lib/cn";
import { syncedAgo, useGmailStatus } from "~/lib/gmail-status";
import { useNow } from "~/hooks/use-now";
import type { GmailStatus, SyncStage } from "~/types/gmail";

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

  return (
    <div className="border-t border-dashed border-white/15 px-2.5 py-3 font-mono text-[10.5px] uppercase tracking-[0.08em]">
      <div className={cn("min-h-[6.25rem]", collapsed && "lg:hidden")} aria-live="polite">
        <p className="eyebrow pb-2 !text-[10px]">Gmail sync</p>
        {syncing ? (
          <StageList stage={status.stage} count={status.stageCount} />
        ) : (
          <IdleSummary status={status} ago={ago} />
        )}
      </div>
      <span
        title={syncing ? "Syncing Gmail" : ago ? `Gmail synced ${ago}` : "Gmail"}
        className={cn("hidden text-center", collapsed && "lg:block", dotColour(status, syncing), syncing && "animate-pulse")}
      >
        ●
      </span>
    </div>
  );
}

function StageList({ stage, count }: { stage: SyncStage | null; count: number | null }) {
  const current = Math.max(0, STAGES.findIndex((s) => s.stage === stage));
  return (
    <ol className="flex flex-col gap-1">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s.stage}
            className={cn("flex gap-2", done ? "text-text-secondary" : active ? "text-text-accent" : "text-text-tertiary")}
          >
            <span className={cn("shrink-0", active && "animate-pulse")}>[{done ? "✓" : active ? "▸" : " "}]</span>
            <span className="truncate">
              {s.label}
              {active && count ? ` ${count}` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function IdleSummary({ status, ago }: { status: GmailStatus; ago: string | null }) {
  if (!status.connected) {
    return (
      <Link to="/profile#integrations" className="text-text-tertiary transition-colors hover:text-text-primary">
        [○] Not connected
      </Link>
    );
  }
  if (status.needsReconnect) {
    return (
      <Link to="/profile#integrations" className="text-red-primary transition-colors hover:text-text-primary">
        [!] Reconnect Gmail
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-text-secondary">
        <span className={status.lastError ? "text-red-primary" : "text-green-primary"}>[{status.lastError ? "!" : "●"}]</span>{" "}
        <span suppressHydrationWarning>
          {status.lastError ? "Failed, retrying" : ago ? `Synced ${ago}` : "Not synced yet"}
        </span>
      </p>
      {!!status.lastFetched && !status.lastError && (
        <p className="pl-[4ch] text-text-tertiary">
          {status.lastFetched} new · {status.lastLinked ?? 0} matched
        </p>
      )}
      {status.hasMore && <p className="pl-[4ch] text-text-tertiary">More to fetch</p>}
    </div>
  );
}

function dotColour(status: GmailStatus, syncing: boolean) {
  if (syncing) return "text-text-accent";
  if (!status.connected) return "text-text-tertiary";
  return status.lastError ? "text-red-primary" : "text-green-primary";
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
