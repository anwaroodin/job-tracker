import { useSelector } from "@legendapp/state/react";
import { Bell, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/atoms/dropdown-menu";
import { STATUS_COLORS } from "~/components/molecules/terminal";
import { ACTIVITY_TABS, activityTab, describeActivity, type ActivityItem, type ActivityTab } from "~/lib/activity";
import { cn } from "~/lib/cn";
import { useGmailStatus } from "~/lib/gmail-status";
import { activityPanel$, activityTab$ } from "~/lib/state/activity-panel";
import { fmtAgo } from "~/lib/time";
import { useNow } from "~/lib/use-now";
import type { GmailStatus } from "~/server/gmail/sync.server";

const ACTIVITY_URL = "/api/activity";
const TOAST_MS = 9000;
const TOAST_ITEMS = 3;
const CLOCK_SKEW_MS = 60_000;

type ActivityData = { items: ActivityItem[] };

export function ActivityBell({ initial }: { initial: GmailStatus }) {
  const status = useGmailStatus(initial);
  const open = useSelector(activityPanel$.open);
  const tab = useSelector(activityTab$.tab);
  const feed = useFetcher<ActivityData>({ key: "activity-feed" });
  const loading = useRef<"idle" | "requested" | "started">("idle");
  const markSeen = useFetcher();
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  const now = useNow();
  const unseen = status.unseenActivity;

  useEffect(() => {
    if (open) {
      loading.current = "requested";
      feed.load(ACTIVITY_URL);
    } else {
      loading.current = "idle";
      setFresh(null);
    }
  }, [open]);

  useEffect(() => {
    if (loading.current === "requested" && feed.state === "loading") loading.current = "started";
    if (loading.current !== "started" || feed.state !== "idle" || !feed.data) return;
    loading.current = "idle";
    const unseenIds = feed.data.items.filter((item) => !item.seen).map((item) => item.id);
    setFresh(new Set(unseenIds));
    if (unseenIds.length) markSeen.submit({}, { method: "post", action: ACTIVITY_URL });
  }, [feed.state, feed.data]);

  return (
    <DropdownMenu open={open} onOpenChange={(next) => activityPanel$.open.set(next)}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unseen ? `${unseen} new ${unseen === 1 ? "update" : "updates"}` : "Updates"}
          className="relative flex size-8 items-center justify-center text-text-tertiary transition-colors hover:bg-white/[0.04] hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary data-[state=open]:bg-white/[0.04] data-[state=open]:text-text-primary"
        >
          <Bell className="size-4" />
          <AnimatePresence>
            {unseen > 0 && (
              <motion.span
                key={unseen}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                className="absolute -right-1 -top-1 min-w-4 bg-green-primary px-1 text-center font-mono text-[9.5px] leading-4 tabular-nums text-text-inverse"
              >
                {unseen > 99 ? "99+" : unseen}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(28rem,calc(100vw-2rem))] p-0 font-mono uppercase tracking-[0.04em]"
      >
        <div className="flex items-baseline justify-between px-3 pt-2.5">
          <span className="eyebrow">What's new</span>
          {fresh && fresh.size > 0 && <span className="text-[10px] tracking-[0.08em] text-green-primary">{fresh.size} new</span>}
        </div>
        <ActivityTabs items={feed.data?.items ?? []} fresh={fresh} selected={tab} />
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-1">
          {!feed.data || !fresh ? (
            <p className="px-2.5 py-3 text-[11px] tracking-[0.08em] text-text-tertiary">Loading…</p>
          ) : inTab(feed.data.items, tab).length === 0 ? (
            <p className="px-2.5 py-3 font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">
              {ACTIVITY_TABS.find((t) => t.id === tab)?.empty}
            </p>
          ) : (
            inTab(feed.data.items, tab).map((item) => (
              <DropdownMenuItem key={item.id} asChild className="items-start py-2">
                <Link to={describeActivity(item).href}>
                  <ActivityRow item={item} fresh={fresh?.has(item.id) ?? false} now={now} />
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityTabs({
  items,
  fresh,
  selected,
}: {
  items: ActivityItem[];
  fresh: Set<string> | null;
  selected: ActivityTab;
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter updates"
      className="no-scrollbar flex overflow-x-auto border-b border-stroke-secondary px-1.5"
    >
      {ACTIVITY_TABS.map(({ id, label }) => {
        const unread = inTab(items, id).filter((item) => fresh?.has(item.id)).length;
        const active = id === selected;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => activityTab$.tab.set(id)}
            className={cn(
              "-mb-px flex shrink-0 grow items-center justify-center gap-1.5 border-b px-2 pb-2 pt-2.5 text-[10.5px] uppercase tracking-[0.06em] transition-colors",
              active
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary",
            )}
          >
            {label}
            {unread > 0 && <span className="tabular-nums text-green-primary">{unread}</span>}
          </button>
        );
      })}
    </div>
  );
}

function inTab(items: ActivityItem[], tab: ActivityTab) {
  return tab === "all" ? items : items.filter((item) => activityTab(item) === tab);
}

export function ActivityToasts({ initial }: { initial: GmailStatus }) {
  const status = useGmailStatus(initial);
  const feed = useFetcher<ActivityData>({ key: "activity-toast" });
  const previousUnseen = useRef(status.unseenActivity);
  const announced = useRef(new Set<string>());
  const mountedAt = useRef(new Date(Date.now() - CLOCK_SKEW_MS).toISOString());
  const [toast, setToast] = useState<ActivityItem[] | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const grew = status.unseenActivity > previousUnseen.current;
    previousUnseen.current = status.unseenActivity;
    if (grew && !activityPanel$.open.peek()) feed.load(ACTIVITY_URL);
  }, [status.unseenActivity]);

  useEffect(() => {
    if (!feed.data) return;
    const arrived = feed.data.items.filter(
      (item) => !item.seen && item.createdAt >= mountedAt.current && !announced.current.has(item.id),
    );
    arrived.forEach((item) => announced.current.add(item.id));
    if (arrived.length) setToast(arrived);
  }, [feed.data]);

  useEffect(() => {
    if (!toast || hovered) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, hovered]);

  const openPanel = () => {
    setToast(null);
    activityPanel$.open.set(true);
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end p-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:p-0"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast[0].id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="pointer-events-auto w-full max-w-sm border border-stroke-primary bg-bg-grouped-primary font-mono uppercase tracking-[0.04em] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-stroke-secondary px-3 py-2">
              <span className="flex items-center gap-2 text-[11px] tracking-[0.08em] text-text-primary">
                <span aria-hidden className="size-1.5 rounded-full bg-green-primary" />
                {toast.length} {toast.length === 1 ? "update" : "updates"} from Gmail
              </span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setToast(null)}
                className="text-text-tertiary transition-colors hover:text-text-primary"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <ul className="p-1">
              {toast.slice(0, TOAST_ITEMS).map((item) => (
                <li key={item.id}>
                  <Link
                    to={describeActivity(item).href}
                    onClick={() => setToast(null)}
                    className="flex px-2.5 py-2 transition-colors hover:bg-fill-secondary"
                  >
                    <ActivityRow item={item} fresh now={Date.now()} />
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={openPanel}
              className="w-full border-t border-stroke-secondary px-3 py-2 text-left text-[10.5px] tracking-[0.1em] text-text-secondary transition-colors hover:text-text-primary"
            >
              {toast.length > TOAST_ITEMS ? `See all ${toast.length}` : "See all updates"} →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivityRow({ item, fresh, now }: { item: ActivityItem; fresh: boolean; now: number }) {
  const { tag, title, body } = describeActivity(item);
  return (
    <div className="flex min-w-0 flex-1 gap-2.5">
      <span
        aria-hidden
        className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", fresh ? "bg-green-primary" : "bg-transparent")}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-3 text-[10px] tracking-[0.08em] text-text-tertiary">
          <span style={{ color: STATUS_COLORS[tag] }}>[{tag}]</span>
          <span className="shrink-0" suppressHydrationWarning>
            {fmtAgo(item.createdAt, now)}
          </span>
        </p>
        <p className="mt-0.5 font-sans text-[13px] normal-case tracking-normal text-text-primary">{title}</p>
        {body && (
          <p className="truncate font-sans text-[12px] normal-case tracking-normal text-text-tertiary">{body}</p>
        )}
      </div>
    </div>
  );
}
