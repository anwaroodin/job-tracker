import { STATUS_COLORS } from "~/components/ui/terminal";
import { describeActivity, type ActivityItem } from "~/lib/activity";
import { cn } from "~/lib/cn";
import { fmtAgo } from "~/lib/format/time";

export function ActivityRow({ item, fresh, now }: { item: ActivityItem; fresh: boolean; now: number }) {
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
