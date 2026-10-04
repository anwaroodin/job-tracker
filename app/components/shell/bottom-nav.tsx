import { NavLink } from "react-router";
import { cn } from "~/lib/cn";
import { NAV } from "./nav";

export function BottomNav({ unread }: { unread: number }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-stroke-secondary bg-bg-secondary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      {NAV.map(({ to, short }, idx) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "relative flex h-14 flex-1 select-none flex-col items-center justify-center gap-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] transition-colors active:bg-fill-tertiary",
              isActive
                ? "text-text-primary before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-text-primary"
                : "text-text-tertiary",
            )
          }
        >
          <span className="relative">
            <span className="text-[11px] tabular-nums text-text-tertiary">{String(idx + 1).padStart(2, "0")}</span>
            {to === "/applications" && unread > 0 && (
              <span
                className="absolute -right-5 -top-1.5 min-w-4 bg-green-quaternary px-1 text-center text-[9px] leading-4 tabular-nums text-green-primary"
                aria-label={`${unread} new ${unread === 1 ? "email" : "emails"}`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          {short}
        </NavLink>
      ))}
    </nav>
  );
}
