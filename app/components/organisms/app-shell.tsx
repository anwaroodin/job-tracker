import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  user: { name?: string | null; email: string; image?: string | null };
  children: ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-bg-secondary text-text-primary">
      <Sidebar user={user} />
      <main className="flex-1 p-3 pl-0">
        <div className="min-h-[calc(100vh-24px)] rounded-16 bg-bg-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]">
          <div className="w-full max-w-5xl px-10 py-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
