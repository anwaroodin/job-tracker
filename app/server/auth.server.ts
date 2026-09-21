/**
 * Better Auth wired to Drizzle + D1 + Google OAuth.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { redirect } from "react-router";
import { getDb } from "./db/client.server";

export function createAuth(env: Env, request?: Request) {
  const origin = request ? new URL(request.url).origin : env.APP_URL;
  return betterAuth({
    database: drizzleAdapter(getDb(env.DB), { provider: "sqlite" }),
    secret: env.SESSION_SECRET,
    baseURL: origin,
    trustedOrigins: [env.APP_URL, "http://localhost:5173"],

    emailAndPassword: { enabled: false },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Allowlist while single-user — a stray sign-in shouldn't grant access.
    // Runs on every sign-in/sign-up.
    databaseHooks: {
      user: {
        create: {
          before: async (data) => {
            const allowed = (env.ALLOWED_EMAILS ?? "")
              .split(",")
              .map((s) => s.trim().toLowerCase())
              .filter(Boolean);
            if (
              allowed.length > 0 &&
              !allowed.includes(data.email.toLowerCase())
            ) {
              throw new Error("This email is not authorised to sign in");
            }
            return { data };
          },
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh cookie once per day
    },

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

export async function getSession(request: Request, env: Env) {
  const auth = createAuth(env, request);
  return auth.api.getSession({ headers: request.headers });
}

export async function requireUser(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session?.user) {
    const url = new URL(request.url);
    const returnTo = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/auth/login?returnTo=${returnTo}`);
  }
  return session.user;
}
