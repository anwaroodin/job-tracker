import type { Db } from "../../db/client.server";
import { getApplication, updateApplication } from "../../db/queries/applications.server";
import { APPLICATION_STATUSES } from "~/lib/status";
import { setByHand } from "./manual";
import { clearBookmarkOnApply } from "./rules";

export async function setStatusByHand(db: Db, userId: string, id: string, status: string) {
  if (status === "saved" || !APPLICATION_STATUSES.some((s) => s === status)) return null;
  const current = await getApplication(db, userId, id);
  return current ? updateApplication(db, userId, id, clearBookmarkOnApply(current.status, setByHand(status))) : null;
}
