/**
 * Recently tracked applications, kept in chrome.storage.local so reopening
 * the popup on the same application offers "fill only" instead of tracking
 * it again. The server also de-duplicates, this just avoids the round trip
 * and keeps the chosen CV between the steps of multi-page forms.
 */
const STORAGE_KEY = "tracked";
const MAX_ENTRIES = 50;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Multi-step forms change URL between pages; treat the same host as the same application for this long. */
const SAME_HOST_MS = 6 * 60 * 60 * 1000;

/**
 * @typedef {{ url: string, host: string, company: string, role: string,
 *   cvType: string, category: string, status?: string, applicationId: string, trackedAt: number }} TrackedEntry
 */

const TRACKING_PARAM = /^(utm_|gh_src$|source$|ref$|referrer$|lever-|trk)/i;

/**
 * Drops the fragment and tracking parameters so links from different sources
 * match. Other query parameters stay, since some boards put the job id there.
 */
export function normaliseUrl(href) {
  try {
    const url = new URL(href);
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(name)) url.searchParams.delete(name);
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

const hostOf = (href) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** @returns {Promise<TrackedEntry[]>} */
async function load() {
  const { [STORAGE_KEY]: entries = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const now = Date.now();
  return Array.isArray(entries) ? entries.filter((e) => now - e.trackedAt < TTL_MS) : [];
}

/**
 * The tracked application this page most likely belongs to: the same URL,
 * the same company and role, or (unless `sameHost` is false) a recent
 * application on the same host, which covers later steps of a form.
 * @returns {Promise<TrackedEntry | null>}
 */
export async function findTracked(job, { sameHost = true } = {}) {
  if (!job) return null;
  const { url, company, role } = job;
  const entries = await load();
  const key = normaliseUrl(url);
  const host = hostOf(url);
  const now = Date.now();
  return (
    entries.find((e) => e.url === key) ??
    entries.find((e) => company && role && same(e.company, company) && same(e.role, role)) ??
    (sameHost ? entries.find((e) => e.host === host && now - e.trackedAt < SAME_HOST_MS) : null) ??
    null
  );
}

/** @param {Omit<TrackedEntry, "host" | "trackedAt">} entry */
export async function rememberTracked(entry) {
  const url = normaliseUrl(entry.url);
  const entries = (await load()).filter((e) => e.url !== url);
  entries.unshift({ ...entry, url, host: hostOf(entry.url), trackedAt: Date.now() });
  await chrome.storage.local.set({ [STORAGE_KEY]: entries.slice(0, MAX_ENTRIES) });
}

/** Forgets an entry so the page can be tracked as a different application. */
export async function forgetTracked(entry) {
  const entries = (await load()).filter((e) => e.url !== entry.url);
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}
