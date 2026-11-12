import { pct, statusColor } from "~/components/ui/terminal";
import { StatusBadge } from "~/components/ui/status-badge";
import type { Analytics } from "~/types/analytics";
import { SideBlock, SideRow } from "~/components/ui/side-block";

export function Pipeline({ analytics: a }: { analytics: Analytics }) {
  const total = a.totals.total;
  const present = a.byStatus.filter((s) => s.count > 0);

  return (
    <>
      <SideBlock title="Pipeline" aside={`${total} total`}>
        <div className="flex h-2 w-full gap-[2px]" role="img" aria-label={present.map((s) => `${s.count} ${s.status}`).join(", ")}>
          {present.map((s) => (
            <span key={s.status} className="h-full min-w-[2px]" style={{ flexGrow: s.count, background: statusColor(s.status) }} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {present.map((s) => (
            <SideRow
              key={s.status}
              label={<StatusBadge status={s.status} variant="dot" className="text-[13.5px]" />}
              note={`${pct(s.count, total)}%`}
              value={s.count}
            />
          ))}
        </div>
      </SideBlock>

      <SideBlock title="How far they got">
        <div className="flex flex-col gap-2">
          {a.funnel.map((f, i) => (
            <SideRow
              key={f.stage}
              label={f.stage}
              note={i === 0 ? "all" : `${pct(f.count, a.funnel[i - 1].count)}% of ${a.funnel[i - 1].stage.toLowerCase()}`}
              value={<span className={i === a.funnel.length - 1 && f.count ? "text-green-primary" : undefined}>{f.count}</span>}
            />
          ))}
        </div>
      </SideBlock>
    </>
  );
}
