/**
 * Origin of the job-tracker dashboard the extension talks to. When changing
 * it, update `exclude_matches` and the `connect-src` CSP in manifest.json to
 * match (see "Pointing at another deployment" in extension/README.md).
 *
 * Set to the local dev server (`npm run dev`); point it at your deployment,
 * e.g. "https://job-tracker.<subdomain>.workers.dev", for everyday use.
 */
export const API_ORIGIN = "http://localhost:5173";

/** Where "Open dashboard" and the sign-in prompt send the user. */
export const DASHBOARD_URL = `${API_ORIGIN}/overview`;
