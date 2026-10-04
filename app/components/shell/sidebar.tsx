import { useSelector } from "@legendapp/state/react";
import { ChevronsUpDown, LogOut, PanelLeft } from "lucide-react";
import { motion } from "motion/react";
import { NavLink, useNavigate } from "react-router";
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
import type { GmailStatus } from "~/types/gmail";
import { cn } from "~/lib/cn";
import logo from "~/assets/job-tracker.png";
import { NAV } from "./nav";

interface SidebarProps {
  user: { name?: string | null; email: string; image?: string | null };
  gmail: GmailStatus;
  unread: number;
}

export function Sidebar({ user, gmail, unread }: SidebarProps) {
  const collapsed = useSelector(sidebarView$.collapsed);
  const navigate = useNavigate();
  const signOut = () =>
    authClient.signOut({
      fetchOptions: { onSuccess: () => navigate("/auth/login") },
    });

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh w-[216px] shrink-0 flex-col self-start border-r border-stroke-secondary bg-bg-secondary px-3 pb-3 pt-[18px] lg:flex",
        collapsed && "w-[64px]",
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
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-3 px-2.5 py-[7px] font-mono text-[11.5px] uppercase tracking-[0.08em] transition-colors duration-150",
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
            {to === "/applications" && unread > 0 && (
              <>
                <motion.span
                  key={unread}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  className={cn(
                    "ml-auto bg-green-quaternary px-1.5 text-[10px] leading-4 tabular-nums text-green-primary",
                    collapsed && "lg:hidden",
                  )}
                  aria-label={`${unread} new ${unread === 1 ? "email" : "emails"}`}
                >
                  {unread}
                </motion.span>
                {collapsed && (
                  <span aria-hidden className="absolute right-3 top-1.5 hidden size-1.5 rounded-full bg-green-primary lg:block" />
                )}
              </>
            )}
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
  );
}
