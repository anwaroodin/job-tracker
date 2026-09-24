import { useSelector } from "@legendapp/state/react";
import { ChevronsUpDown, LogOut, PanelLeft, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/atoms/dropdown-menu";
import { SyncStatus } from "~/components/molecules/sync-status";
import { sidebarView$ } from "~/lib/state/sidebar-view";
import type { GmailStatus } from "~/server/gmail/sync.server";
import { cn } from "~/lib/cn";
import logo from "~/assets/job-tracker.png";

const NAV = [
  { to: "/overview", label: "Overview" },
  { to: "/applications", label: "Applications" },
  { to: "/profile", label: "Profile" },
] as const;

interface SidebarProps {
  user: { name?: string | null; email: string; image?: string | null };
  gmail: GmailStatus;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ user, gmail, mobileOpen, onCloseMobile }: SidebarProps) {
  const collapsed = useSelector(sidebarView$.collapsed);
  const navigate = useNavigate();
  const signOut = () =>
    authClient.signOut({
      fetchOptions: { onSuccess: () => navigate("/auth/login") },
    });

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[216px] shrink-0 flex-col border-r border-stroke-secondary bg-bg-secondary px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[18px] transition-transform duration-200 lg:sticky lg:top-0 lg:self-start lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed && "lg:w-[64px]",
        )}
      >
        <div
          className={cn(
            "relative flex items-center gap-2.5 px-2.5 pb-7",
            collapsed ? "p-0 mx-auto pb-4" : "px-2.5",
          )}
        >
          <img
            src={logo}
            className="size-8 shrink-0 mix-blend-difference"
            alt="Logo"
          />
          <span
            className={cn(
              "truncate text-[16px] font-medium tracking-[-0.03em] text-text-primary",
              collapsed && "lg:hidden",
            )}
          >
            job-tracker
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto text-text-tertiary transition-colors hover:text-text-primary lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <p
          className={cn(
            "eyebrow px-2.5 pb-2 !text-[10px]",
            collapsed && "lg:hidden",
          )}
        >
          Workspace
        </p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label }, idx) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-2.5 py-[7px] font-mono text-[11.5px] uppercase tracking-[0.08em] transition-colors duration-150",
                  collapsed && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-fill-secondary text-text-primary"
                    : "text-[#c9c9cd] hover:bg-fill-tertiary hover:text-text-primary",
                )
              }
            >
              <span className="text-text-tertiary">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className={cn(collapsed && "lg:hidden")}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">
          <SyncStatus initial={gmail} collapsed={collapsed} />
          <button
            type="button"
            onClick={() => sidebarView$.collapsed.set(!collapsed)}
            className={cn(
              "flex cursor-pointer w-full items-center gap-3 px-2.5 py-2.5 font-mono text-[11.5px] uppercase tracking-[0.08em] transition-colors duration-150 text-[#c9c9cd] hover:bg-fill-tertiary hover:text-text-primary",
              collapsed && "lg:justify-center lg:px-0",
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="size-3.5 shrink-0" />
            <span className={cn(collapsed && "lg:hidden")}>Collapse</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "group flex w-full items-center gap-2.5 text-left transition-colors hover:bg-fill-tertiary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary",
                  collapsed ? "lg:justify-center p-1" : "p-2",
                )}
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    className="size-7 shrink-0 rounded-full"
                  />
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fill-secondary text-[11px] font-medium text-text-primary">
                    {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
                  <p className="truncate text-[12.5px] font-medium text-text-primary">
                    {user.name ?? user.email}
                  </p>
                  <p className="truncate text-[11px] text-text-tertiary">
                    {user.email}
                  </p>
                </div>
                <ChevronsUpDown
                  className={cn(
                    "size-3.5 shrink-0 text-text-tertiary",
                    collapsed && "lg:hidden",
                  )}
                />
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
    </>
  );
}
