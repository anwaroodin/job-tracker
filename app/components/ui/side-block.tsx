import type { ReactNode } from "react";

export function SideBlock({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-stroke-secondary pt-5 first:border-t-0 first:pt-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-medium text-text-primary">{title}</h2>
        {aside && <span className="text-[12.5px] text-text-tertiary">{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function SideRow({ lead, label, value, note }: { lead?: ReactNode; label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[13.5px]">
      {lead}
      <span className="min-w-0 flex-1 truncate text-text-secondary">{label}</span>
      {note && <span className="text-[12.5px] tabular-nums text-text-tertiary">{note}</span>}
      <span className="w-8 text-right font-medium tabular-nums text-text-primary">{value}</span>
    </div>
  );
}
