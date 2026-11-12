import type { ReactNode } from "react";
import { stagger } from "~/components/ui/terminal";

export function ListSection({
  id,
  title,
  count,
  actions,
  children,
}: {
  id?: string;
  title: string;
  count?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rise scroll-mt-16 font-sans normal-case tracking-normal" style={stagger(2)}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 className="flex items-baseline gap-2 text-[16px] font-medium text-text-primary">
          {title}
          {count !== undefined && <span className="text-[13.5px] font-normal tabular-nums text-text-tertiary">{count}</span>}
        </h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
