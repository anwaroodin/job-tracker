/**
 * Better Auth wired to Drizzle + D1 + Google OAuth.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { getDb } from "../db/client.server";
import { updateSyncState } from "../db/queries/gmail-sync.server";
import { kvStorage } from "./kv-storage.server";

export function createAuth(env: Env, request?: Request) {
  const origin = request ? new URL(request.url).origin : env.APP_URL;
  const db = getDb(env.DB);
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret: env.SESSION_SECRET,
    baseURL: origin,
    trustedOrigins: [env.APP_URL, "http://localhost:5173"],

    emailAndPassword: { enabled: false },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        accessType: "offline",
      },
    },

    databaseHooks: {
      account: {
        update: {
          after: async (acc) => {
            if (acc.providerId !== "google" || !acc.scope?.includes(GMAIL_SCOPE)) return;
            await updateSyncState(db, acc.userId, { lastError: null });
          },
        },
      },
    },

    secondaryStorage: kvStorage(env.SESSIONS),
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh cookie once per day
      // Skips the KV/D1 session lookup for 5 minutes; a revoked session lasts at most that long.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
      storeSessionInDatabase: true,
    },
    verification: { storeInDatabase: true },
    rateLimit: { storage: "memory" },

    advanced: {
      cookiePrefix: "jt",
      // SameSite=None + Secure so the browser extension can send the session
      // cookie on cross-origin fetches to /api/ext/*. Better Auth handles
      // CSRF separately via signed origin/state checks.
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
