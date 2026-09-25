import { cn } from "~/lib/cn";

/** Greys by default; colour only where the status carries meaning. */
export const STATUS_COLORS: Record<string, string> = {
  applied: "#d4d4d8",
  screening: "#a6a7ad",
  interview: "#e8b33c",
  assessment: "#f0cf85",
  offer: "#58b68a",
  accepted: "#8fd0ae",
  rejected: "#d1707a",
  ghosted: "#6e6f76",
  withdrawn: "#4a4c53",
};
export const CV_COLORS = ["#ececec", "#6e6f76", "#4a4c53"];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const two = (n: number) => String(n).padStart(2, "0");

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${two(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;
export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export function Section({
  n,
  title,
  hint,
  i,
  id,
  className,
  children,
}: {
  n: string;
  title: string;
  hint?: React.ReactNode;
  i: number;
  /** Anchor id for jump-to-section nav — gets scroll-margin so the sticky path bar doesn't cover it. */
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("rise scroll-mt-16 border-t border-dashed border-white/15 pt-5", className)} style={stagger(i)}>
      <header className="mb-4 flex items-baseline justify-between gap-4 text-[11px] tracking-[0.12em]">
        <h2>
          <b className="mr-2 font-semibold text-text-primary">[{n}]</b>
          <span className="text-text-secondary">{title}</span>
        </h2>
        {hint && <span className="text-text-tertiary">{hint}</span>}
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/** `LABEL ........... value` — dotted leader between the two. */
export function Leader({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-[7px]">
      <span className="text-text-secondary">{label}</span>
      <span className="min-w-4 flex-1 -translate-y-[3px] border-b border-dotted border-white/25" />
      <span className="text-text-primary">{children}</span>
    </div>
  );
}

/** Block-glyph bar: `████████░░░░░░`. */
export function Bar({ share, color, cells }: { share: number; color: string; cells: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, share)) / 100) * cells);
  return (
    <span aria-hidden className="block min-w-0 select-none overflow-hidden whitespace-pre tracking-[-0.05em]">
      <span style={{ color }}>{"█".repeat(filled)}</span>
      <span className="text-white/[0.1]">{"░".repeat(cells - filled)}</span>
    </span>
  );
}

export function BarRow({
  label,
  value,
  share,
  color,
  cells,
  note,
  labelClass,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  share: number;
  color: string;
  cells: number;
  note?: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-4 py-[5px]">
      <span className={cn("w-[92px] shrink-0 truncate text-text-secondary", labelClass)}>{label}</span>
      <Bar share={share} color={color} cells={cells} />
      <span className={cn("w-8 shrink-0 text-right text-text-primary", valueClass)}>{value}</span>
      <span className="hidden w-14 text-right text-text-tertiary sm:block">{note}</span>
    </div>
  );
}

export interface Column {
  key: string;
  label: string;
  value: number;
  display: string;
}

/** Column chart: bar height by share of peak, value above, label below, faint quartile gridlines. */
export function ColumnChart({
  columns,
  peak,
  showValues = true,
  labelEvery = 1,
}: {
  columns: Column[];
  peak: number;
  showValues?: boolean;
  labelEvery?: number;
}) {
  return (
    <div>
      <div
        className="flex h-36 items-end gap-1.5 border-b border-white/15"
        style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0, transparent calc(25% - 1px), rgba(255,255,255,.06) 25%)" }}
      >
        {columns.map((c, i) => {
          const latest = i === columns.length - 1;
          return (
            <div key={c.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${c.label}: ${c.display}`}>
              {showValues && (
                <span
                  className={cn(
                    "mb-1.5 text-[10px] tabular-nums",
                    latest ? "text-text-primary" : "text-text-tertiary group-hover:text-text-secondary",
                  )}
                >
                  {c.display}
                </span>
              )}
              <div
                className={cn("w-full transition-colors", latest ? "bg-text-primary" : "bg-fill-primary group-hover:bg-white/30")}
                style={{ height: `${Math.max(2, (c.value / peak) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {columns.map((c, i) => (
          <span
            key={c.key}
            className={cn(
              "min-w-0 flex-1 text-center text-[9.5px] text-text-tertiary",
              labelEvery > 1 ? "overflow-visible whitespace-nowrap" : "truncate",
            )}
          >
            {i % labelEvery === 0 ? c.label.toUpperCase() : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
