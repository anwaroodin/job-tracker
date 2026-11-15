import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight01Icon, Logout01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { SANS_PAGE } from "~/components/ui/page-section";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Avatar } from "./avatar";
import { NAV, NAV_ICONS } from "./nav";

const TABS = ["/overview", "/applications", "/cv", "/interviews"];
const MORE = NAV.filter((item) => !TABS.includes(item.to));

type User = { name?: string | null; email: string; image?: string | null };

const TAB = "relative flex h-14 flex-1 cursor-pointer select-none flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors";

function TabContent({ icon, label, active, badge }: { icon: IconSvgElement; label: string; active: boolean; badge?: number }) {
  return (
    <>
      <span className={cn("relative grid h-7 w-12 place-items-center transition-colors", active && "bg-ink/[0.07]")}>
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
        {badge ? (
          <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-green-primary px-1 text-center text-[10px] leading-4 tabular-nums text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      {label}
    </>
  );
}

export function BottomNav({ user, unread }: { user: User; unread: number }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const inMore = MORE.some((item) => pathname.startsWith(item.to));

  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex border-t border-stroke-secondary bg-bg-primary/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden",
        SANS_PAGE,
      )}
    >
      {TABS.map((to) => {
        const item = NAV.find((n) => n.to === to)!;
        return (
          <NavLink key={to} to={to} className={({ isActive }) => cn(TAB, isActive ? "text-text-primary" : "text-text-tertiary")}>
            {({ isActive }) => (
              <TabContent
                icon={NAV_ICONS[to]}
                label={to === "/applications" ? "Jobs" : item.label}
                active={isActive}
                badge={to === "/applications" ? unread : undefined}
              />
            )}
          </NavLink>
        );
      })}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger className={cn(TAB, inMore || open ? "text-text-primary" : "text-text-tertiary")}>
          <TabContent icon={MoreHorizontalIcon} label="More" active={inMore || open} />
        </DialogPrimitive.Trigger>
        <MoreSheet user={user} close={() => setOpen(false)} />
      </DialogPrimitive.Root>
    </nav>
  );
}

function MoreSheet({ user, close }: { user: User; close: () => void }) {
  const navigate = useNavigate();
  const signOut = () => authClient.signOut({ fetchOptions: { onSuccess: () => navigate("/auth/login") } });
  const row = "flex h-12 items-center gap-3 px-4 text-[14.5px] text-text-primary transition-colors active:bg-ink/[0.05]";

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim lg:hidden" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "rise fixed inset-x-0 bottom-0 z-50 border-t border-stroke-primary bg-sidebar-active pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-24px_64px_rgba(0,0,0,0.18)] lg:hidden",
          SANS_PAGE,
        )}
      >
        <DialogPrimitive.Title className="sr-only">More</DialogPrimitive.Title>
        <span aria-hidden className="mx-auto mt-2 block h-1 w-9 rounded-full bg-ink/15" />
        <div className="flex items-center gap-3 border-b border-stroke-secondary px-4 pb-4 pt-3">
          <Avatar user={user} className="size-10 text-[15px]" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-text-primary">{user.name ?? user.email}</p>
            {user.name && <p className="truncate text-[13px] text-text-tertiary">{user.email}</p>}
          </div>
        </div>
        <nav aria-label="More" className="flex flex-col py-1">
          {MORE.map(({ to, label }) => (
            <Link key={to} to={to} onClick={close} className={row}>
              <HugeiconsIcon icon={NAV_ICONS[to]} size={20} strokeWidth={1.5} className="text-text-secondary" />
              <span className="flex-1">{label}</span>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} className="text-text-tertiary" />
            </Link>
          ))}
          <button type="button" onClick={signOut} className={cn(row, "cursor-pointer border-t border-stroke-secondary text-left")}>
            <HugeiconsIcon icon={Logout01Icon} size={20} strokeWidth={1.5} className="text-text-secondary" />
            Sign out
          </button>
        </nav>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
