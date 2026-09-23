import { STATUS_COLORS } from "~/components/molecules/terminal";

/** `[status]` in the colour that status uses everywhere else in the app (bars, dots, log). */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={className} style={{ color: STATUS_COLORS[status] ?? "#a6a7ad" }}>
      [{status}]
    </span>
  );
}
