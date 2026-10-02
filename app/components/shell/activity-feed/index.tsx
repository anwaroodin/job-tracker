import { useSelector } from "@legendapp/state/react";
import { Bell } from "lucide-react";
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
