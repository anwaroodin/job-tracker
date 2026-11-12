import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { describeActivity, type ActivityItem } from "~/lib/activity";
import { useGmailStatus } from "~/lib/gmail-status";
import { activityPanel$ } from "~/lib/state/activity-panel";
import type { GmailStatus } from "~/types/gmail";
import { ACTIVITY_URL, type ActivityData } from "~/components/shell/activity-feed/activity-data";
import { ActivityRow } from "~/components/shell/activity-feed/row";

const TOAST_MS = 9000;
const TOAST_ITEMS = 3;
const CLOCK_SKEW_MS = 60_000;

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
      className="pointer-events-none fixed inset-x-0 bottom-[var(--bottom-nav)] z-50 flex justify-end p-4 sm:inset-x-auto sm:right-6 sm:bottom-[calc(var(--bottom-nav)+1.5rem)] sm:p-0"
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
            className="pointer-events-auto w-full max-w-sm border border-stroke-primary bg-sidebar-active font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
          >
            <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
              <span className="flex items-center gap-2 font-medium text-text-primary">
                <span aria-hidden className="size-2 rounded-full bg-green-primary" />
                {toast.length} {toast.length === 1 ? "update" : "updates"} from Gmail
              </span>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setToast(null)}
                className="cursor-pointer p-1 text-text-tertiary transition-colors hover:bg-ink/[0.05] hover:text-text-primary"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
              </button>
            </div>
            <ul className="px-2 py-1">
              {toast.slice(0, TOAST_ITEMS).map((item) => (
                <li key={item.id}>
                  <Link
                    to={describeActivity(item).href}
                    onClick={() => setToast(null)}
                    className="flex min-h-12 px-3 py-2 transition-colors hover:bg-ink/[0.06]"
                  >
                    <ActivityRow item={item} fresh now={Date.now()} />
                  </Link>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={openPanel}
              className="w-full cursor-pointer border-t border-stroke-secondary bg-sidebar px-4 py-2.5 text-left text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              {toast.length > TOAST_ITEMS ? `See all ${toast.length}` : "See all notifications"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
