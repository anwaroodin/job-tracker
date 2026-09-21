import { Outlet } from "react-router";
import type { Route } from "./+types/layout";
import { AppShell } from "~/components/organisms/app-shell";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const user = await requireUser(request, context.get(envContext));
  return { user };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell user={loaderData.user}>
      <Outlet />
    </AppShell>
  );
}
