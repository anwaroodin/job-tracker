import { useEffect, useRef } from "react";
import { Link, useFetcher, useFetchers, useRevalidator, type FetcherWithComponents } from "react-router";
import { cn } from "~/lib/cn";
import type { GmailStatus, SyncStage } from "~/server/gmail/sync.server";

const STATUS_URL = "/api/gmail/status";
const POLL_WHILE_SYNCING_MS = 1500;
const POLL_WHILE_IDLE_MS = 60_000;

const STAGES: { stage: SyncStage; label: string }[] = [
  { stage: "checking", label: "Checking inbox" },
  { stage: "downloading", label: "Downloading" },
  { stage: "classifying", label: "Classifying" },
];

export function SyncStatus({ initial, collapsed }: { initial: GmailStatus; collapsed: boolean }) {
  const poll = useFetcher<GmailStatus>({ key: "gmail-status" });
  const status = poll.data && "connected" in poll.data ? poll.data : initial;
  const manualSyncRunning = useFetchers().some((f) => f.state !== "idle" && f.formData?.get("intent") === "sync");
  const syncing = status.syncing || manualSyncRunning;

  usePolling(poll, syncing);
  useRefreshWhenSyncFinishes(status);

  return (
    <div className="border-t border-dashed border-white/15 px-2.5 py-3 font-mono text-[10.5px] uppercase tracking-[0.08em]">
      <div className={cn(collapsed && "lg:hidden")} aria-live="polite">
        <p className="eyebrow pb-2 !text-[10px]">Gmail sync</p>
        {syncing ? <StageList stage={status.stage} count={status.stageCount} /> : <IdleSummary status={status} />}
      </div>
      <span
        title={syncing ? "Syncing Gmail" : status.lastSynced ? `Gmail synced ${status.lastSynced}` : "Gmail"}
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

function IdleSummary({ status }: { status: GmailStatus }) {
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
        {status.lastError ? "Failed, retrying" : status.lastSynced ? `Synced ${status.lastSynced}` : "Not synced yet"}
      </p>
      {status.lastFetched !== null && !status.lastError && (
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

function usePolling(poll: FetcherWithComponents<GmailStatus>, syncing: boolean) {
  const hasLoaded = poll.data !== undefined;
  useEffect(() => {
    const load = () => {
      if (document.visibilityState === "visible") poll.load(STATUS_URL);
    };
    const delay = !hasLoaded ? 0 : syncing ? POLL_WHILE_SYNCING_MS : POLL_WHILE_IDLE_MS;
    const timer = setTimeout(load, delay);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [poll.data, syncing]);
}

function useRefreshWhenSyncFinishes(status: GmailStatus) {
  const revalidator = useRevalidator();
  const wasSyncing = useRef(status.syncing);
  useEffect(() => {
    const justFinished = wasSyncing.current && !status.syncing;
    if (justFinished && (status.lastFetched || status.lastLinked)) revalidator.revalidate();
    wasSyncing.current = status.syncing;
  }, [status.syncing]);
}
