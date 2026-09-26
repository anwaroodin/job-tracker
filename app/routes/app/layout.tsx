import { Outlet, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/layout";
import { AppShell } from "~/components/organisms/app-shell";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { unreadEmailCounts } from "~/server/db/emails.server";
import { getGmailStatus } from "~/server/gmail/sync.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [gmail, unread] = await Promise.all([getGmailStatus(db, user.id), unreadEmailCounts(db, user.id)]);
  const path = new URL(request.url).pathname.replace(/\.data$/, "");
  const openApplication = /^\/applications\/([^/]+)$/.exec(path)?.[1];
  const unreadTotal = Object.entries(unread).reduce((sum, [id, n]) => (id === openApplication ? sum : sum + n), 0);
  return { user, gmail, unreadTotal };
}

export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return currentUrl.pathname !== nextUrl.pathname || defaultShouldRevalidate;
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell user={loaderData.user} gmail={loaderData.gmail} unread={loaderData.unreadTotal}>
      <Outlet />
    </AppShell>
  );
}
