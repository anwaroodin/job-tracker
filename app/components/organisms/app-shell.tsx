import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  user: { name?: string | null; email: string; image?: string | null };
  children: ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-dvh w-full bg-bg-primary text-text-primary">
      <Sidebar user={user} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <main className="min-w-0 flex-1">
        <PathBar onOpenMobile={() => setMobileOpen(true)} />
        <div className="mr-auto w-full max-w-[1200px] px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:ml-16 lg:px-8 lg:pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}
function PathBar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…` : s);

  return (
    <div className="flex h-[52px] items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobile}
        className="text-text-tertiary transition-colors hover:text-text-primary lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-4" />
      </button>
      <nav className="eyebrow flex min-w-0 items-center gap-2.5 overflow-hidden">
        <span className="shrink-0">job-tracker</span>
        {segments.map((s, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 opacity-50">/</span>
            <span className={i === segments.length - 1 ? "truncate text-text-primary" : "shrink-0"}>
              {short(s)}
            </span>
          </span>
        ))}
      </nav>
    </div>
  );
}
