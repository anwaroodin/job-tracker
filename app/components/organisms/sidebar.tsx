import { ChevronsUpDown, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import type { ReactNode } from "react";
import { authClient } from "~/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/atoms/dropdown-menu";
import { cn } from "~/lib/cn";

const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    stroke="currentColor"
    className="size-4"
  >
    {path}
  </svg>
);
const IconOverview = icon(
  <>
    <rect x="2" y="2" width="5.5" height="5.5" rx="1.5" />
    <rect x="8.5" y="2" width="5.5" height="5.5" rx="1.5" />
    <rect x="2" y="8.5" width="5.5" height="5.5" rx="1.5" />
    <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" />
  </>,
);
const IconApplications = icon(
  <>
    <rect x="2.25" y="4" width="11.5" height="9" rx="1.5" />
    <path d="M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
    <path d="M2.5 8h11" />
  </>,
);
const IconProfile = icon(
  <>
    <circle cx="8" cy="5.75" r="2.5" />
    <path d="M3 13.5a5 5 0 0 1 10 0" />
  </>,
);

const NAV = [
  { to: "/overview", label: "Overview", icon: IconOverview },
  { to: "/applications", label: "Applications", icon: IconApplications },
  { to: "/profile", label: "Profile", icon: IconProfile },
] as const;

interface SidebarProps {
  user: { name?: string | null; email: string; image?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const navigate = useNavigate();
  const signOut = () =>
    authClient.signOut({
      fetchOptions: { onSuccess: () => navigate("/auth/login") },
    });
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col gap-1 p-3">
      <div className="mb-3 flex items-center gap-2 px-2 pt-1">
        <div className="flex size-6 items-center justify-center rounded-6 bg-text-primary text-[10px] font-semibold text-black">
          02
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-text-primary">
          job-tracker
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-8 px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-100",
                isActive
                  ? "bg-fill-secondary text-text-primary"
                  : "text-text-secondary hover:bg-fill-tertiary hover:text-text-primary",
              )
            }
          >
            {icon}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center gap-2 rounded-8 p-1.5 text-left transition-colors hover:bg-fill-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20"
            >
              {user.image ? (
                <img src={user.image} alt="" className="size-7 rounded-full" />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-fill-secondary text-[11px] font-medium text-text-primary">
                  {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-text-primary">
                  {user.name ?? user.email}
                </p>
                <p className="truncate text-[11px] text-text-secondary">
                  {user.email}
                </p>
              </div>
              <ChevronsUpDown className="size-3.5 text-text-tertiary" />
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
