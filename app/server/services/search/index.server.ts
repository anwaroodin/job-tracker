import type { SearchResults } from "~/types/search";
import type { Db } from "../../db/client.server";
import { matchingSearchRows, recentSearchRows } from "../../db/queries/search.server";
import { deduplicateApplications } from "../applications/dedupe";

export async function globalSearch(db: Db, userId: string, query: string): Promise<SearchResults> {
  const q = query.trim().toLowerCase();

  if (!q) {
    const [recentApps, recentEmails] = await recentSearchRows(db, userId);
    return { applications: deduplicateApplications(recentApps).slice(0, 6), emails: recentEmails };
  }

  const [apps, emails] = await matchingSearchRows(db, userId, q);
  return { applications: deduplicateApplications(apps).slice(0, 12), emails };
}
