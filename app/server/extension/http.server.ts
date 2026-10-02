/**
 * Helpers for the browser-extension API routes under /api/ext/*.
 *
 * The extension has no login of its own: it shares the Better Auth session
 * cookie of the web app. As long as the user is signed in on the dashboard in
 * the same browser, the extension's `fetch(..., { credentials: "include" })`
 * carries that cookie, so these responses echo the extension's origin and
 * allow credentials.
 */
import { getSession } from "~/server/auth/session.server";

const EXTENSION_ORIGIN = /^(chrome|moz)-extension:\/\//;

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": EXTENSION_ORIGIN.test(origin) ? origin : "",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

/** The answer to a CORS preflight. Every route in this namespace returns it for OPTIONS. */
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

/**
 * The request's JSON object body, or the error response to send instead.
 *
 * Requiring a JSON content type is part of the CSRF defence: the session
 * cookie is SameSite=None, and a JSON body can't be sent cross-site without a
 * CORS preflight, which only extension origins pass.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json(request, { error: "unsupported_media_type" }, { status: 415 });
  }
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Falls through to the error below.
  }
  return json(request, { error: "invalid_json" }, { status: 400 });
}

/**
 * Runs an /api/ext/* handler, turning unexpected failures (a missing D1
 * column after an unapplied migration, for example) into a JSON 500 the
 * extension can show. The cause is logged for `wrangler tail`, not returned.
 */
export async function guarded(request: Request, handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    console.error(`${request.method} ${new URL(request.url).pathname} failed`, error);
    return json(request, { error: "server_error" }, { status: 500 });
  }
}

/** The signed-in user, or null (never a redirect: the extension handles 401s itself). */
export async function extUser(request: Request, env: Env) {
  const session = await getSession(request, env);
  return session?.user ?? null;
}
