import { ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { useShortcutLabel } from "~/hooks/use-shortcut-label";
import { CommandPalette } from "~/components/shell/command-palette";
import { commandPalette$ } from "~/lib/state/command-palette";
import type { GmailStatus } from "~/types/gmail";
import { Tour } from "~/components/onboarding/tour";
import { ActivityBell } from "./activity-feed";
import { ActivityToasts } from "./activity-feed/toasts";
import { BottomNav } from "./bottom-nav";
import { NAV } from "./nav";
import { SidePanel } from "./side-panel";
import { Sidebar } from "./sidebar";
import { TailoringTray } from "./tailoring-tray";

interface AppShellProps {
  user: { name?: string | null; email: string; image?: string | null };
  gmail: GmailStatus;
  unread: number;
  children: ReactNode;
}

export function AppShell({ user, gmail, unread, children }: AppShellProps) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh w-full bg-bg-primary text-text-primary">
        <Sidebar user={user} gmail={gmail} unread={unread} />
        <main className="min-w-0 flex-1">
          <PathBar gmail={gmail} />
          <div className="mx-auto w-full max-w-[1200px] px-4 pb-[calc(var(--bottom-nav)+2.5rem)] pt-4 sm:px-6 lg:px-8 lg:pb-20">
            {children}
          </div>
        </main>
        <SidePanel />
      </div>
      <BottomNav unread={unread} />
      <ActivityToasts initial={gmail} />
      <CommandPalette />
      <TailoringTray />
      <Tour />
    </MotionConfig>
  );
}

function PathBar({ gmail }: { gmail: GmailStatus }) {
  const { pathname } = useLocation();
  const shortcut = useShortcutLabel();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((s, i) => {
    const to = `/${segments.slice(0, i + 1).join("/")}`;
    const label = NAV.find((n) => n.to === to)?.label ?? (/^[0-9a-f-]{20,}$/.test(s) ? "Details" : s.charAt(0).toUpperCase() + s.slice(1));
    return { to, label };
  });

  return (
    <div className="max-lg:sticky max-lg:top-0 max-lg:z-30 max-lg:border-b max-lg:border-stroke-secondary max-lg:bg-bg-primary/95 max-lg:pt-[env(safe-area-inset-top)] max-lg:backdrop-blur-sm">
      <div className="mx-auto flex h-[52px] w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[13.5px] text-text-tertiary">
          {crumbs.map((crumb, i) => (
            <span key={crumb.to} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={1.5} className="shrink-0" />}
              {i === crumbs.length - 1 ? (
                <span aria-current="page" className="truncate font-medium text-text-primary">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="shrink-0 transition-colors hover:text-text-primary">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => commandPalette$.open.set(true)}
            data-tour="search"
            className="hidden h-8 cursor-pointer items-center gap-2 border border-stroke-secondary bg-bg-primary px-2.5 text-[13px] text-text-tertiary transition-colors hover:border-stroke-primary hover:text-text-primary sm:inline-flex lg:hidden"
            title={`Search (${shortcut})`}
          >
            <HugeiconsIcon icon={Search01Icon} size={15} strokeWidth={1.5} />
            <span>Search</span>
            <kbd className="bg-ink/[0.06] px-1.5 font-sans text-[11.5px] text-text-tertiary">{shortcut}</kbd>
          </button>
          <button
            type="button"
            onClick={() => commandPalette$.open.set(true)}
            className="p-1.5 text-text-tertiary transition-colors hover:text-text-primary sm:hidden cursor-pointer"
            title="Search"
            aria-label="Search"
          >
            <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={1.5} />
          </button>
          <ActivityBell initial={gmail} />
        </div>
      </div>
    </div>
  );
}
