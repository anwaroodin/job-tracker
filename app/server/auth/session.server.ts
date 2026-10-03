import { AsyncLocalStorage } from "node:async_hooks";
import { createContext, redirect } from "react-router";
import { createAuth } from "./config.server";

// Cookies Better Auth sets while reading a session (the 5-minute session cache),
// added to the response in workers/app.ts.
export const sessionCookies = new AsyncLocalStorage<string[]>();

// Reads trust the cached session; anything that changes data checks KV/D1, so a
// revoked session can't write during the cache window.
const READ_ONLY_METHODS = new Set(["GET", "HEAD"]);

export async function getSession(request: Request, env: Env) {
  const auth = createAuth(env, request);
  const { headers, response } = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: !READ_ONLY_METHODS.has(request.method) },
    returnHeaders: true,
  });
  sessionCookies.getStore()?.push(...headers.getSetCookie());
  return response;
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

export type SessionUser = Awaited<ReturnType<typeof requireUser>>;

export const userContext = createContext<SessionUser>();
