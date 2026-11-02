import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { NewBadge } from "~/components/ui/new-badge";
import { StatusBadge } from "~/components/ui/status-badge";
import { fmtDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { APPLICATION_STATUSES } from "~/lib/status";
import type { ApplicationRowData } from "~/types/application";
import type { TabKey } from "./use-applications-view";

const COLUMNS: Record<TabKey, readonly string[]> = {
  open: ["applied", "screening", "assessment", "interview", "offer", "accepted"],
  active: ["applied", "screening", "assessment", "interview"],
  offers: ["offer", "accepted"],
  closed: ["rejected", "ghosted", "withdrawn"],
  all: APPLICATION_STATUSES.filter((s) => s !== "saved"),
};

const DRAG_TYPE = "application/x-job-tracker-id";

export function ApplicationsBoard({ items, tab }: { items: ApplicationRowData[]; tab: TabKey }) {
  const fetcher = useFetcher();
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [over, setOver] = useState<string | null>(null);
  useEffect(() => setMoved({}), [items]);

  const statusOf = (app: ApplicationRowData) => moved[app.id] ?? app.status;
  const move = (id: string, status: string) => {
    const app = items.find((a) => a.id === id);
    if (!app || statusOf(app) === status) return;
    setMoved((m) => ({ ...m, [id]: status }));
    fetcher.submit({ intent: "status", status }, { method: "post", action: `/applications/${id}` });
  };

  const dropTarget = (status: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setOver(status);
    },
    onDragLeave: () => setOver((s) => (s === status ? null : s)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      move(e.dataTransfer.getData(DRAG_TYPE), status);
    },
  });

  const columns = COLUMNS[tab].map((status) => ({ status, cards: items.filter((a) => statusOf(a) === status) }));
  const empty = columns.filter((c) => !c.cards.length);

  return (
    <div className="flex flex-col gap-3">
      {empty.length > 0 && (
        <ul aria-label="Empty statuses" className="flex flex-wrap gap-2 text-[11px]">
          {empty.map(({ status }) => (
            <li
              key={status}
              {...dropTarget(status)}
              className={cn(
                "flex items-center gap-2 border border-dashed border-white/15 px-2.5 py-1.5 transition-colors",
                over === status && "border-text-secondary bg-fill-tertiary",
              )}
            >
              <StatusBadge status={status} />
              <span className="text-text-tertiary tabular-nums">0</span>
            </li>
          ))}
        </ul>
      )}
      <div className="-mx-1 overflow-x-auto overscroll-x-contain pb-2">
        <div className="flex min-w-max items-start gap-3 px-1">
          {columns
            .filter((c) => c.cards.length)
            .map(({ status, cards }) => (
              <section
                key={status}
                aria-label={status}
                {...dropTarget(status)}
                className={cn(
                  "flex max-h-[calc(100dvh-14rem)] w-64 shrink-0 flex-col border border-dashed border-white/15 p-2 transition-colors",
                  over === status && "border-text-secondary bg-fill-tertiary",
                )}
              >
                <header className="flex items-center justify-between px-1 pb-2 text-[11px] leading-[22px]">
                  <StatusBadge status={status} />
                  <span className="text-text-tertiary tabular-nums">{cards.length}</span>
                </header>
                <div className="-mr-1 flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-y-contain pr-1">
                  {cards.map((app) => (
                    <BoardCard key={app.id} app={app} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}

function BoardCard({ app }: { app: ApplicationRowData }) {
  return (
    <Link
      to={`/applications/${app.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, app.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group flex shrink-0 cursor-grab flex-col gap-1 border border-stroke-secondary bg-bg-grouped-primary px-3 py-2.5 transition-colors hover:bg-text-primary active:cursor-grabbing",
        app.unread && "shadow-[inset_2px_0_0_var(--color-green-primary)]",
      )}
    >
      <span className="flex items-center gap-2">
        <CompanyLogo company={app.company} logoUrl={app.logoUrl} />
        <span className="truncate text-[12.5px] font-medium text-text-primary group-hover:!text-text-inverse">{app.company}</span>
        {Boolean(app.unread) && <NewBadge count={app.unread} className="ml-auto" />}
      </span>
      <span className="truncate font-sans text-[12.5px] normal-case tracking-normal text-text-secondary group-hover:!text-text-inverse/85">
        {app.role}
      </span>
      <span className="text-[10.5px] tabular-nums text-text-tertiary group-hover:!text-text-inverse/60">{fmtDate(app.appliedAt)}</span>
    </Link>
  );
}
