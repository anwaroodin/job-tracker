/**
 * The job-tracker dashboard the extension talks to: the hosted one, unless the
 * options page points it somewhere else for development. The override is
 * kept in chrome.storage.sync.
 */

export const DEFAULT_ORIGIN = "https://job-tracker.anwars.workers.dev";

const STORAGE_KEY = "dashboardOrigin";

/**
 * Plain http is only for a dashboard running on this machine (`npm run dev`).
 * Keep in step with connect-src in manifest.json.
 */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;

/**
 * The origin of a dashboard address the user typed ("job-tracker.example.dev",
 * "https://job-tracker.example.dev/overview"), or null when it isn't one:
 * https only, except for a dashboard on this machine.
 */
export function dashboardOriginFrom(input) {
  const text = String(input ?? "").trim();
  if (!text) return null;
  try {
    // No scheme typed: https, except the dev server on this machine, which only speaks http.
    const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(text);
    const local = LOCAL_HOST.test(text.split(/[:/]/)[0]);
    const url = new URL(hasScheme ? text : `${local ? "http" : "https"}://${text}`);
    const allowed = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOST.test(url.hostname));
    return allowed ? url.origin : null;
  } catch {
    return null;
  }
}

/** The dashboard origin: the saved override, or the hosted dashboard. */
export async function getDashboardOrigin() {
  const { [STORAGE_KEY]: origin } = await chrome.storage.sync.get(STORAGE_KEY);
  return dashboardOriginFrom(origin) ?? DEFAULT_ORIGIN;
}

/** Saves a dashboard address, or clears the override when it's empty; returns the origin now used, or null when it isn't valid. */
export async function setDashboardOrigin(input) {
  if (!String(input ?? "").trim()) {
    await chrome.storage.sync.remove(STORAGE_KEY);
    return DEFAULT_ORIGIN;
  }
  const origin = dashboardOriginFrom(input);
  if (origin) await chrome.storage.sync.set({ [STORAGE_KEY]: origin });
  return origin;
}

/** The dashboard page for an application, or the overview. */
export function dashboardUrl(origin, applicationId) {
  return applicationId ? `${origin}/applications/${encodeURIComponent(applicationId)}` : `${origin}/overview`;
}

/** The page that tailors a CV and cover letter to an application. */
export const tailorUrl = (origin, applicationId) => `${dashboardUrl(origin, applicationId)}/cv`;
