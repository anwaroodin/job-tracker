import { RouterContextProvider, createRequestHandler } from "react-router";
import { envContext, execContext } from "~/server/context.server";
import { syncAllGmailUsers } from "~/server/gmail/sync.server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CROSS_ORIGIN_PATHS = ["/api/ext/", "/api/auth/"];

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    if (isCrossOriginMutation(request)) return new Response("Forbidden", { status: 403 });
    const context = new RouterContextProvider();
    context.set(envContext, env);
    context.set(execContext, ctx);
    return requestHandler(request, context);
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(syncAllGmailUsers(env));
  },
} satisfies ExportedHandler<Env>;

function isCrossOriginMutation(request: Request) {
  if (SAFE_METHODS.has(request.method)) return false;
  const url = new URL(request.url);
  if (CROSS_ORIGIN_PATHS.some((path) => url.pathname.startsWith(path))) return false;
  const origin = request.headers.get("Origin");
  return origin !== null && origin !== url.origin;
}
