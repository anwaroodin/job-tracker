import { createContext, redirect } from "react-router";
import { createAuth } from "./config.server";

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

export type SessionUser = Awaited<ReturnType<typeof requireUser>>;

export const userContext = createContext<SessionUser>();
