/**
 * Secrets set with `wrangler secret put` don't land in worker-configuration.d.ts.
 * Declare them here so `env.SECRET_NAME` type-checks in loaders and actions.
 * Bindings (DB, CVS, SESSIONS, ASSETS) and non-secret vars (APP_URL) come
 * from wrangler's generated file automatically.
 */
declare global {
  interface Env {
    // Secrets — set with `wrangler secret put <NAME>`
    SESSION_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    // Optional: comma-separated allowlist while single-user
    ALLOWED_EMAILS?: string;
    // Optional: classifies emails with Jev when set, otherwise the regex classifier is used
    TYPESAFE_API_KEY?: string;
    // Optional: "regex" turns Jev off even when TYPESAFE_API_KEY is set
    EMAIL_CLASSIFIER?: "jev" | "regex";
  }
}

export {};
