import { Menu, Search } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { CommandPalette } from "~/components/shell/command-palette";
import { commandPalette$ } from "~/lib/state/command-palette";
import type { GmailStatus } from "~/types/gmail";
import { ActivityBell } from "./activity-feed";
import { ActivityToasts } from "./activity-feed/toasts";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  user: { name?: string | null; email: string; image?: string | null };
  gmail: GmailStatus;
  unread: number;
  children: ReactNode;
}

export function AppShell({ user, gmail, unread, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh w-full bg-bg-primary text-text-primary">
        <Sidebar
          user={user}
          gmail={gmail}
          unread={unread}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main className="min-w-0 flex-1">
          <PathBar gmail={gmail} onOpenMobile={() => setMobileOpen(true)} />
          <div className="mx-auto w-full max-w-[1200px] px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pb-20">
            {children}
          </div>
        </main>
      </div>
      <ActivityToasts initial={gmail} />
      <CommandPalette />
    </MotionConfig>
  );
}

function PathBar({ gmail, onOpenMobile }: { gmail: GmailStatus; onOpenMobile: () => void }) {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…` : s);

  return (
    <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
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
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => commandPalette$.open.set(true)}
          className="hidden sm:inline-flex items-center gap-2 border border-stroke-secondary bg-fill-secondary px-2.5 py-1 font-mono text-[11px] text-text-tertiary transition-colors hover:border-stroke-primary hover:text-text-primary cursor-pointer"
          title="Search (Ctrl+K)"
        >
          <Search className="size-3" />
          <span>Search</span>
          <kbd className="border border-stroke-secondary px-1 text-[9px] text-text-tertiary">Ctrl+K</kbd>
        </button>
        <button
          type="button"
          onClick={() => commandPalette$.open.set(true)}
          className="p-1.5 text-text-tertiary transition-colors hover:text-text-primary sm:hidden cursor-pointer"
          title="Search"
          aria-label="Search"
        >
          <Search className="size-4" />
        </button>
        <ActivityBell initial={gmail} />
      </div>
    </div>
  );
}
