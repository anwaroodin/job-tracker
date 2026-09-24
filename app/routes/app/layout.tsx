import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { AppShell } from "~/components/organisms/app-shell";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getGmailStatus } from "~/server/gmail/sync.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const gmail = await getGmailStatus(getDb(env.DB), user.id);
  return { user, gmail };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell user={loaderData.user} gmail={loaderData.gmail}>
      <Outlet />
    </AppShell>
  );
}
