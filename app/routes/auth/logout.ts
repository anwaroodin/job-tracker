import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { createAuth } from "~/server/auth.server";
import { envContext } from "~/server/context.server";

export async function action({ request, context }: Route.ActionArgs) {
  const auth = createAuth(context.get(envContext), request);
  const res = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const headers = new Headers(res.headers);
  headers.set("Location", "/auth/login");
  return new Response(null, { status: 302, headers });
}

export async function loader() {
  throw redirect("/");
}
