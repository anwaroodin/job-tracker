import { ANALYTICS_CACHE, invalidate } from "../../cache.server";
import type { Db } from "../../db/client.server";
import { deleteSavedApplication, unapplyApplication, updateSavedApplication } from "../../db/queries/applications.server";
import { clearBookmarkOnApply } from "./rules";

/**
 * Turns a saved posting into an application dated today, or deletes it.
 * Returns false when the row isn't a saved posting.
 */
export async function settleSavedJob(db: Db, userId: string, id: string, outcome: "applied" | "removed") {
  const now = new Date().toISOString();
  const settled =
    outcome === "removed"
      ? await deleteSavedApplication(db, userId, id)
      : await updateSavedApplication(db, userId, id, {
          ...clearBookmarkOnApply("saved", { status: "applied", manualStatusAt: now, appliedAt: now }),
          updatedAt: now,
        });
  if (!settled.length) return false;
  await invalidate(ANALYTICS_CACHE, userId);
  return true;
}

/** Moves an application back to a saved posting. Returns false once any email is linked to it. */
export async function unsettleAppliedJob(db: Db, userId: string, id: string) {
  if (!(await unapplyApplication(db, userId, id)).length) return false;
  await invalidate(ANALYTICS_CACHE, userId);
  return true;
}
