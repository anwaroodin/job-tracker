export type SyncStage = "checking" | "downloading" | "classifying" | "reviewing";

export interface SyncResult {
  fetched: number;
  linked: number;
  more: boolean;
  busy?: boolean;
  error?: string;
}

export interface GmailStatus {
  connected: boolean;
  syncing: boolean;
  stage: SyncStage | null;
  stageCount: number | null;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  needsReconnect: boolean;
  lastFetched: number | null;
  lastLinked: number | null;
  hasMore: boolean;
  autoSync: boolean;
  unseenActivity: number;
}
