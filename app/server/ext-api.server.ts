/**
 * Helpers for browser-extension API routes under /api/ext/*.
 *
 * The extension shares the user's login state via the Better Auth session
 * cookie. as long as the user is signed in on the web app in the same
 * browser, the extension's fetch with `credentials: 'include'` carries that
 * cookie along. We echo the origin and enable credentials so preflight and
 * cookie-bearing requests succeed.
 */
import { getSession } from "~/server/auth.server";

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allow =
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://")
      ? origin
      : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

export function preflight(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function json(request: Request, body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(request),
      ...(init.headers ?? {}),
    },
  });
}

export async function extUser(request: Request, env: Env) {
  const session = await getSession(request, env);
  return session?.user ?? null;
}
