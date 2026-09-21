import { redirect } from "react-router";
import type { Route } from "./+types/index";
import { getSession } from "~/server/auth.server";
import { envContext } from "~/server/context.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  throw redirect(session?.user ? "/overview" : "/auth/login");
}

export default function Index() {
  return null;
}
