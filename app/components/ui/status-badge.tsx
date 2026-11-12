import { STATUS_COLORS } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";

/** `[status]` in the colour that status uses everywhere else in the app; `dot` shows it as "● Status". */
export function StatusBadge({ status, className, variant }: { status: string; className?: string; variant?: "dot" }) {
  const color = STATUS_COLORS[status] ?? "var(--text-secondary)";
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 capitalize text-text-secondary", className)}>
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {status}
      </span>
    );
  }
  return (
    <span className={className} style={{ color }}>
      [{status}]
    </span>
  );
}
