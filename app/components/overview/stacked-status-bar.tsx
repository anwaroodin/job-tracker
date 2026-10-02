import { STATUS_COLORS } from "~/components/ui/terminal";

/**
 * Splits `cells` between counts in proportion (largest remainder method), so
 * the parts always add up to exactly `cells` and no count rounds away to more
 * than its share.
 */
function apportion(counts: number[], cells: number) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((n) => (n / total) * cells);
  const parts = exact.map(Math.floor);
  const leftover = cells - parts.reduce((sum, n) => sum + n, 0);
  const byRemainder = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < leftover; k++) parts[byRemainder[k][1]]++;
  return parts;
}

/** Every status in one glyph bar (`████▓▓▓░░`), with a legend of the largest few. */
export function StackedStatusBar({ byStatus, cells = 34 }: { byStatus: { status: string; count: number }[]; cells?: number }) {
  const present = byStatus.filter((s) => s.count > 0);
  if (!present.length) return null;
  const widths = apportion(
    present.map((s) => s.count),
    cells,
  );
  const segments = present
    .map((s, i) => ({ status: s.status, color: STATUS_COLORS[s.status] ?? "#6e6f76", width: widths[i] }))
    .filter((s) => s.width > 0);
  const LEGEND = 4;

  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="block min-w-0 select-none overflow-hidden whitespace-pre tracking-[-0.05em]">
        {segments.map((s) => (
          <span key={s.status} style={{ color: s.color }}>
            {"█".repeat(s.width)}
          </span>
        ))}
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-tertiary">
        {segments.slice(0, LEGEND).map((s) => (
          <span key={s.status} className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: s.color }} />
            {s.status}
          </span>
        ))}
        {segments.length > LEGEND && <span>+{segments.length - LEGEND} more</span>}
      </div>
    </div>
  );
}
