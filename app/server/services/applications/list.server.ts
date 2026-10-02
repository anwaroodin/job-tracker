import type { Db } from "../../db/client.server";
import { applicationRows } from "../../db/queries/applications.server";
import { deduplicateApplications } from "./dedupe";

export async function listApplications(db: Db, userId: string) {
  return deduplicateApplications(await applicationRows(db, userId));
}
