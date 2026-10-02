/**
 * Better Auth wired to Drizzle + D1 + Google OAuth.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { getDb } from "../db/client.server";
import { updateSyncState } from "../db/queries/gmail-sync.server";
import { assertAllowed } from "./allowlist.server";
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

    // Allowlist while single-user — a stray sign-in shouldn't grant access.
    // Runs on every sign-in/sign-up.
    databaseHooks: {
      user: {
        create: {
          before: async (data) => {
            assertAllowed(env, data.email);
            return { data };
          },
        },
      },
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
