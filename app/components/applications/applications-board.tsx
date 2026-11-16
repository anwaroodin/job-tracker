import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { StatusBadge } from "~/components/ui/status-badge";
import { shortDate } from "~/components/ui/terminal";
import { statusWord } from "~/components/shell/brand-word";
import { celebrate } from "~/lib/state/milestone";
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
    if (statusWord(status)) celebrate({ applicationId: id, company: app.company, role: app.role, status });
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
    <div className="mx-[calc(50%-50cqw)] flex flex-col gap-3">
      {empty.length > 0 && (
        <ul aria-label="Empty statuses" className="flex flex-wrap items-center gap-2 px-4 text-[13px] sm:px-6 lg:px-8">
          {empty.map(({ status }) => (
            <li
              key={status}
              {...dropTarget(status)}
              className={cn(
                "flex h-8 items-center gap-2 border border-stroke-secondary px-2.5 transition-colors",
                over === status && "border-stroke-primary bg-ink/[0.05]",
              )}
            >
              <StatusBadge status={status} variant="dot" />
              <span className="tabular-nums text-text-tertiary">0</span>
            </li>
          ))}
        </ul>
      )}
      <div className="overflow-x-auto overscroll-x-contain px-4 pb-2 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3">
          {columns
            .filter((c) => c.cards.length)
            .map(({ status, cards }) => (
              <section
                key={status}
                aria-label={status}
                {...dropTarget(status)}
                className={cn(
                  "flex max-h-[calc(100dvh-14rem)] min-w-[232px] max-w-[360px] flex-[1_1_0] flex-col bg-sidebar p-1.5 outline outline-1 outline-transparent transition-colors",
                  over === status && "bg-ink/[0.06] outline-stroke-primary",
                )}
              >
                <header className="flex h-8 items-center justify-between px-1.5 text-[13px]">
                  <StatusBadge status={status} variant="dot" className="font-medium text-text-primary" />
                  <span className="tabular-nums text-text-tertiary">{cards.length}</span>
                </header>
                <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-y-contain">
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
      className="flex shrink-0 cursor-grab flex-col gap-1 border border-stroke-secondary bg-bg-primary px-3 py-2.5 transition-colors hover:border-stroke-primary active:cursor-grabbing"
    >
      <span className="flex items-center gap-2">
        <CompanyLogo company={app.company} logoUrl={app.logoUrl} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text-primary">{app.company}</span>
        {Boolean(app.unread) && (
          <span className="size-2 shrink-0 rounded-full bg-green-primary" title={`${app.unread} new`}>
            <span className="sr-only">{app.unread} new</span>
          </span>
        )}
      </span>
      <span className="truncate text-[13px] text-text-secondary">{app.role}</span>
      <span className="text-[12px] tabular-nums text-text-tertiary">Applied {shortDate(app.appliedAt)}</span>
    </Link>
  );
}
