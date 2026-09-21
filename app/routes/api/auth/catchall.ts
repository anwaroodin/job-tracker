import type { Route } from "./+types/catchall";
import { createAuth } from "~/server/auth.server";
import { envContext } from "~/server/context.server";

/**
 * Splat route mounted at /api/auth/* — Better Auth handles every sub-path
 * (sign-in, sign-up, callback, sign-out, session, etc.) itself.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  return createAuth(context.get(envContext), request).handler(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  return createAuth(context.get(envContext), request).handler(request);
}
