import {
  Search01Icon,
  SidebarLeftIcon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { LogOut } from "lucide-react";
import { motion } from "motion/react";
import { Link, NavLink, useNavigate } from "react-router";
import { useApplicationViews } from "~/components/applications/view-tabs";
import { authClient } from "~/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SyncStatus } from "~/components/gmail/sync-status";
import { sidebarView$ } from "~/lib/state/sidebar-view";
import { commandPalette$ } from "~/lib/state/command-palette";
import type { GmailStatus } from "~/types/gmail";
import { usePersisted } from "~/hooks/use-persisted";
import { useShortcutLabel } from "~/hooks/use-shortcut-label";
import { cn } from "~/lib/cn";
import { NAV, NAV_ICONS } from "./nav";
import { Mark, Wordmark } from "./wordmark";
import { SidebarLessons } from "~/components/onboarding/sidebar-lessons";

interface SidebarProps {
  user: { name?: string | null; email: string; image?: string | null };
  gmail: GmailStatus;
  unread: number;
}


const Icon = ({ icon, className }: { icon: IconSvgElement; className?: string }) => (
  <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} className={cn("shrink-0", className)} />
);

const GROUPS: { title: string; links: string[] }[] = [
  { title: "Job search", links: ["/overview", "/applications", "/interviews"] },
  { title: "You", links: ["/cv", "/profile", "/usage", "/settings"] },
];

const ROW = "flex h-9 items-center gap-2.5 px-2.5 text-[14px] font-medium transition-colors";

export function Sidebar({ user, gmail, unread }: SidebarProps) {
  const collapsed = usePersisted(() => sidebarView$.collapsed.get(), false);
  const navigate = useNavigate();
  const views = useApplicationViews();
  const shortcut = useShortcutLabel();
  const signOut = () => authClient.signOut({ fetchOptions: { onSuccess: () => navigate("/auth/login") } });

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col self-start overflow-y-auto bg-sidebar px-3 pb-3 pt-4 font-sans normal-case tracking-normal lg:flex",
        collapsed && "w-[68px] px-2.5",
      )}
    >
      <Link to="/overview" className={cn("flex h-9 items-center px-2.5", collapsed && "justify-center px-0")}>
        {collapsed ? <Mark className="size-5" /> : <Wordmark className="h-[22px]" />}
      </Link>

      <button
        type="button"
        onClick={() => commandPalette$.open.set(true)}
        data-tour="search"
        title={`Search (${shortcut})`}
        className={cn(
          "mt-4 flex h-9 cursor-pointer items-center gap-2 border border-stroke-secondary bg-sidebar-active px-2.5 text-[13.5px] text-text-tertiary transition-colors hover:border-stroke-primary hover:text-text-secondary",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon icon={Search01Icon} className="size-4" />
        {!collapsed && (
          <>
            Search
            <kbd className="ml-auto border border-stroke-secondary px-1.5 font-sans text-[11px] text-text-tertiary">{shortcut}</kbd>
          </>
        )}
      </button>

      <nav data-tour="nav" className="mt-2 flex flex-col">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            {collapsed ? (
              <span aria-hidden className="mx-auto my-3 h-px w-5 bg-stroke-primary" />
            ) : (
              <p className="px-2.5 pb-1.5 pt-4 text-[12px] font-medium text-text-tertiary">{group.title}</p>
            )}
            {group.links.map((to) => {
              const item = NAV.find((n) => n.to === to)!;
              return (
                <div key={to} className="flex flex-col">
                  <NavLink
                    to={to}
                    data-nav={to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        ROW,
                        "relative",
                        collapsed && "justify-center px-0",
                        isActive
                          ? "bg-sidebar-active text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--stroke-secondary)]"
                          : "text-text-secondary hover:bg-ink/[0.05] hover:text-text-primary",
                      )
                    }
                  >
                    <Icon icon={NAV_ICONS[to]} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {to === "/applications" && unread > 0 && (
                      <motion.span
                        key={unread}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 26 }}
                        aria-label={`${unread} new ${unread === 1 ? "email" : "emails"}`}
                        className={cn(
                          "grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11.5px] font-semibold tabular-nums text-white",
                          collapsed ? "absolute right-1 top-0.5 h-4 min-w-4 px-1 text-[10px]" : "ml-auto",
                        )}
                      >
                        {unread}
                      </motion.span>
                    )}
                  </NavLink>
                  {to === "/applications" && views && !collapsed && <SubNav views={views} />}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <SidebarLessons gmailConnected={gmail.connected} collapsed={collapsed} />

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <SyncStatus initial={gmail} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => sidebarView$.collapsed.set(!collapsed)}
          className={cn(ROW, "cursor-pointer text-text-tertiary hover:bg-ink/[0.05] hover:text-text-primary", collapsed && "justify-center px-0")}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon icon={SidebarLeftIcon} />
          {!collapsed && "Collapse"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 text-left transition-colors hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
                collapsed ? "justify-center p-1.5" : "p-2",
              )}
            >
              {user.image ? (
                <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full" />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white">
                  {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-text-primary">{user.name ?? user.email}</p>
                    <p className="truncate text-[12px] text-text-tertiary">{user.email}</p>
                  </div>
                  <Icon icon={UnfoldMoreIcon} className="size-4 text-text-tertiary" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function SubNav({ views }: { views: NonNullable<ReturnType<typeof useApplicationViews>> }) {
  return (
    <ul className="my-1 ml-[19px] flex flex-col gap-px border-l border-stroke-primary pl-3">
      {views.tabs.map((tab) => {
        const on = tab.key === views.selected;
        return (
          <li key={tab.key}>
            <Link
              to={`/applications?view=${tab.key}`}
              replace={views.onListPage}
              preventScrollReset
              aria-current={on ? "page" : undefined}
              data-tour={tab.key}
              className={cn(
                "flex h-8 items-center justify-between px-2.5 text-[13.5px] transition-colors",
                on ? "bg-ink/[0.06] font-medium text-text-primary" : "text-text-secondary hover:bg-ink/[0.05] hover:text-text-primary",
              )}
            >
              {tab.label}
              <span className="text-[12px] font-medium tabular-nums text-text-tertiary">{tab.count}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
