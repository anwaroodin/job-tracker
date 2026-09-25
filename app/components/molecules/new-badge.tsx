import { cn } from "~/lib/cn";

export function NewBadge({ count, className }: { count?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 bg-green-quaternary px-1.5 py-px text-[10px] leading-4 tracking-[0.08em] text-green-primary",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-green-primary" />
      {count === undefined ? "New" : `${count} new`}
    </span>
  );
}
