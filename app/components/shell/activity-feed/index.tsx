import { useSelector } from "@legendapp/state/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { ACTIVITY_TABS, activityTab, describeActivity, type ActivityItem, type ActivityTab } from "~/lib/activity";
import { cn } from "~/lib/cn";
import { useGmailStatus } from "~/lib/gmail-status";
import { activityPanel$, activityTab$ } from "~/lib/state/activity-panel";
import { useNow } from "~/hooks/use-now";
import type { GmailStatus } from "~/types/gmail";
import { ACTIVITY_URL, type ActivityData } from "~/components/shell/activity-feed/activity-data";
import { ActivityRow } from "~/components/shell/activity-feed/row";

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
          className="relative flex size-9 items-center justify-center text-text-tertiary transition-colors hover:bg-ink/[0.04] hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary data-[state=open]:bg-ink/[0.04] data-[state=open]:text-text-primary"
        >
          <HugeiconsIcon icon={Notification01Icon} size={18} strokeWidth={1.5} />
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
        className="w-[min(30rem,calc(100vw-2rem))] border-stroke-primary bg-sidebar-active p-0 font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <span className="text-[16px] font-medium text-text-primary">Notifications</span>
          {fresh && fresh.size > 0 && <span className="text-[12.5px] font-medium text-green-primary">{fresh.size} new</span>}
        </div>
        <ActivityTabs items={feed.data?.items ?? []} fresh={fresh} selected={tab} />
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto px-2 py-1">
          {!feed.data || !fresh ? (
            <p className="animate-pulse px-3 py-10 text-center text-[13px] text-text-tertiary">Loading…</p>
          ) : inTab(feed.data.items, tab).length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-medium text-text-primary">You're all caught up</p>
              <p className="mt-1 text-[13px] text-text-tertiary">{ACTIVITY_TABS.find((t) => t.id === tab)?.empty}</p>
            </div>
          ) : (
            <ActivityGroups items={inTab(feed.data.items, tab)} fresh={fresh} now={now} />
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityGroups({ items, fresh, now }: { items: ActivityItem[]; fresh: Set<string>; now: number }) {
  const groups = [
    { title: "New", items: items.filter((item) => fresh.has(item.id)) },
    { title: "Earlier", items: items.filter((item) => !fresh.has(item.id)) },
  ].filter((group) => group.items.length);
  return groups.map((group) => (
    <div key={group.title} className="flex flex-col pb-2">
      <p className="px-3 pb-1.5 pt-2 text-[12px] font-medium text-text-tertiary">{group.title}</p>
      {group.items.map((item) => (
        <DropdownMenuItem
          key={item.id}
          asChild
          className="min-h-12 cursor-pointer rounded-none px-3 py-2 focus:bg-ink/[0.06] data-[highlighted]:bg-ink/[0.06]"
        >
          <Link to={describeActivity(item).href}>
            <ActivityRow item={item} fresh={fresh.has(item.id)} now={now} />
          </Link>
        </DropdownMenuItem>
      ))}
    </div>
  ));
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
      className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-stroke-secondary px-4 pb-3"
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
              "flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3 text-[13px] font-medium transition-colors",
              active ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
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
