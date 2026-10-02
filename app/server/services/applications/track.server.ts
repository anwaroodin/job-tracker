import type { NewApplication } from "~/types/application";
import type { Db } from "../../db/client.server";
import {
  createApplication,
  findRecentDuplicate,
  getApplication,
  updateApplication,
} from "../../db/queries/applications.server";
import type { JobDetails } from "../../extension/input.server";
import { setByHand } from "../status/manual";
import { clearBookmarkOnApply } from "../status/rules";

interface Posting {
  company: string;
  role: string;
  url: string;
  status: string;
  details: Partial<JobDetails>;
  starred: boolean | undefined;
  autoFilled: boolean;
}

/**
 * Tracks a posting. Idempotent per posting: when the same URL, or the same
 * company and role, was tracked in the last 30 days, the existing application
 * is updated and returned instead.
 */
export async function trackPosting(db: Db, userId: string, posting: Posting) {
  const { company, role, url, status, details, starred } = posting;
  const existing = await findRecentDuplicate(db, userId, { url, company, role });
  if (existing) {
    // Fill in details that loaded after the first save (LinkedIn renders
    // descriptions lazily), but keep the company and role already stored.
    const { company: _company, role: _role, ...rest } = details;
    const patch: Partial<NewApplication> = rest;
    // Applying to a saved posting turns the bookmark into the application.
    if (existing.status === "saved" && status && status !== "saved") {
      const now = new Date().toISOString();
      Object.assign(patch, { ...setByHand(status, now), appliedAt: now });
    }
    if (starred !== undefined) patch.starred = starred;
    clearBookmarkOnApply(existing.status, patch);
    if (Object.keys(patch).length) await updateApplication(db, userId, existing.id, patch);
    return { duplicate: true, application: await getApplication(db, userId, existing.id) };
  }

  const application = await createApplication(db, {
    ...details,
    id: crypto.randomUUID(),
    userId,
    company,
    role,
    url,
    cvType: details.cvType ?? "software",
    category: details.category ?? null,
    ...(status ? setByHand(status) : { status: "applied", manualStatusAt: null }),
    starred: starred === true,
    autoFilled: posting.autoFilled,
  });
  return { duplicate: false, application };
}
