/**
 * Client for the dashboard's /api/ext/* endpoints. Requests carry the
 * dashboard's session cookie, so the user signs in once on the web app.
 */
import { API_ORIGIN } from "../config.js";

/** Thrown on a 401 so callers can switch to the sign-in prompt. */
export class AuthError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "AuthError";
  }
}

async function request(path, init = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    // The API answers errors with { error: "<code>" }; surface it rather than a bare status.
    const body = await res.json().catch(() => null);
    throw new Error(`Request failed (${res.status}${body?.error ? `: ${body.error}` : ""})`);
  }
  return res.json();
}

/** @returns {Promise<{ total: number, byStatus: Record<string, number> }>} */
export const getStats = () => request("/api/ext/stats");

export const getProfile = () => request("/api/ext/profile");

/**
 * Logs an application. The server returns the existing record instead of a
 * new one when the same posting was tracked recently.
 * @returns {Promise<{ duplicate: boolean, application: { id: string } }>}
 */
export const logApplication = (payload) =>
  request("/api/ext/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });

/**
 * The application tracked for a posting, matched on URL or company + role.
 * @returns {Promise<{ application: object | null }>} the full application row, or null
 */
export function lookupApplication({ url, company, role }) {
  const params = new URLSearchParams({ url: url ?? "", company: company ?? "", role: role ?? "" });
  return request(`/api/ext/applications?${params}`);
}

/**
 * Updates an application from the action bar: its status, its bookmark/star
 * (`starred`), or job details the page rendered after it was saved.
 */
export const updateApplication = (id, patch) =>
  request(`/api/ext/applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
