import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export const tokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(Math.round(n)));
export const seconds = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${Math.round(ms / 1000)}s`);
export const percent = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

export interface Column {
  label: string;
  width: string;
  align?: "right";
  hideOnMobile?: boolean;
}

export function DataTable({ columns, rows, minWidth = 560 }: { columns: Column[]; rows: { key: string; cells: ReactNode[] }[]; minWidth?: number }) {
  const template = { gridTemplateColumns: columns.map((c) => c.width).join(" ") };
  const cellClass = (c: Column, i: number) => cn(c.align === "right" && "text-right", i === 0 && "min-w-0 truncate");

  return (
    <div className="-mx-3 overflow-x-auto">
      <div style={{ minWidth }}>
        <div className="grid items-center gap-x-4 border-b border-stroke-secondary px-3 pb-2 text-[12px] font-medium text-text-tertiary" style={template}>
          {columns.map((c, i) => (
            <span key={c.label} className={cellClass(c, i)}>
              {c.label}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid min-h-11 items-center gap-x-4 border-b border-stroke-secondary px-3 py-2 tabular-nums last:border-b-0 hover:bg-ink/[0.04]" style={template}>
            {row.cells.map((cell, i) => (
              <span key={i} className={cn(cellClass(columns[i], i), i === 0 ? "text-text-primary" : "text-text-secondary")}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Meter({ share, over }: { share: number; over: boolean }) {
  return (
    <div className="h-1 w-full bg-ink/[0.07]" role="presentation">
      <div className={cn("h-full", over ? "bg-red-primary" : "bg-text-secondary")} style={{ width: `${Math.min(100, Math.max(0, share * 100))}%` }} />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-stroke-secondary px-6 py-10 text-center">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[13px] text-text-tertiary">{children}</p>
    </div>
  );
}

export function TwoColumns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-10">{main}</div>
      <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">{aside}</aside>
    </div>
  );
}

export function Figure({ label, value, note, tone }: { label: ReactNode; value: ReactNode; note?: ReactNode; tone?: "bad" }) {
  return (
    <div className="flex items-baseline gap-3 text-[13.5px]">
      <span className="min-w-0 flex-1 truncate text-text-secondary">{label}</span>
      {note && <span className="text-[12.5px] tabular-nums text-text-tertiary">{note}</span>}
      <span className={cn("font-medium tabular-nums", tone === "bad" ? "text-red-primary" : "text-text-primary")}>{value}</span>
    </div>
  );
}

export const SideNote = ({ children }: { children: ReactNode }) => <p className="text-[12.5px] leading-relaxed text-text-tertiary">{children}</p>;
