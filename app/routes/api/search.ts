import { data } from "react-router";
import type { Route } from "./+types/search";
import { getSession } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { globalSearch } from "~/server/services/search/index.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) throw data({ error: "not_authenticated" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const results = await globalSearch(getDb(env.DB), session.user.id, q);
  return results;
}
