import { LOCKED_STATUSES } from "~/lib/status";
import type { NewApplication } from "~/types/application";

export interface StatusChange {
  applicationId: string;
  from: string;
  to: string;
}

interface TrackedStatus {
  status: string;
  manualStatusAt: string | null;
}

interface StageEmail {
  category: string;
  receivedAt: string;
}

export function shouldFollowEmail(app: TrackedStatus, latest: StageEmail) {
  if (latest.category === app.status || LOCKED_STATUSES.has(app.status)) return false;
  const setByHandAfterEmail = app.manualStatusAt !== null && latest.receivedAt <= app.manualStatusAt;
  return !setByHandAfterEmail;
}

export function refreshedStatus(app: TrackedStatus, evidenceAt: string | undefined, latestCategory: string | undefined) {
  if (!evidenceAt || LOCKED_STATUSES.has(app.status)) return null;
  const setByHandSinceLastEmail = app.manualStatusAt !== null && app.manualStatusAt >= evidenceAt;
  if (setByHandSinceLastEmail) return null;
  const status = latestCategory ?? "applied";
  return status === app.status ? null : status;
}

export function clearBookmarkOnApply(currentStatus: string, patch: Partial<NewApplication>) {
  const leavingSaved = currentStatus === "saved" && patch.status !== undefined && patch.status !== "saved";
  if (leavingSaved && patch.starred === undefined) patch.starred = false;
  return patch;
}
