import { useSelector } from "@legendapp/state/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Link } from "react-router";
import { Button } from "~/components/atoms/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/atoms/dropdown-menu";
import { Input } from "~/components/atoms/input";
import { NewBadge } from "~/components/molecules/new-badge";
import { StatusBadge } from "~/components/molecules/status-badge";
import { fmtDate } from "~/components/molecules/terminal";
import { applicationsView$ } from "~/lib/state/applications-view";
import { useArrivals } from "~/lib/use-arrivals";
import type { Application } from "~/server/db/schema";

export type ApplicationRow = Application & { unread?: number };
import { cn } from "~/lib/cn";

const MotionLink = motion.create(Link);
const ARRIVE = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

const HIDDEN_STATUSES = new Set(["rejected", "ghosted"]);
const STATUS_FILTERS = ["all", "applied", "interview", "offer", "rejected", "ghosted"] as const;
/** Company | Role | Status | CV | Applied — shared by the header row and every data row. */
const GRID_COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_100px_74px_108px]";

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  return <span className="text-[9px]">{dir === "asc" ? "▲" : dir === "desc" ? "▼" : "◆"}</span>;
}

const columns: ColumnDef<ApplicationRow>[] = [
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline gap-2">
          <span title={row.original.company} className="truncate text-text-primary group-hover:!text-text-inverse">
            {row.original.company}
          </span>
          <UnreadMark count={row.original.unread} />
        </p>
        {row.original.location && (
          <p className="mt-0.5 truncate text-[10px] text-text-tertiary group-hover:!text-text-inverse/60">{row.original.location}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <span title={row.original.role} className="block truncate text-text-secondary group-hover:!text-text-inverse/80">
        {row.original.role}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} className="group-hover:!text-text-inverse" />,
  },
  {
    accessorKey: "cvType",
    header: "CV",
    cell: ({ row }) => <span className="text-text-tertiary group-hover:!text-text-inverse/60">{row.original.cvType}</span>,
  },
  {
    accessorKey: "appliedAt",
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary"
        >
          Applied
          <SortIcon dir={column.getIsSorted()} />
        </button>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right">
        <span className="tabular-nums text-text-tertiary group-hover:!text-text-inverse/60">{fmtDate(row.original.appliedAt)}</span>
      </div>
    ),
  },
];

export function ApplicationDataTable({ rows }: { rows: ApplicationRow[] }) {
  const isArrival = useArrivals(rows.map((r) => r.id));
  const search = useSelector(applicationsView$.search);
  const status = useSelector(applicationsView$.status);
  const sorting = useSelector(applicationsView$.sorting);
  const showHidden = useSelector(applicationsView$.showHidden);

  // Split rows before feeding TanStack — visible bucket + hidden (ghosted/rejected).
  const { visible, hidden } = useMemo(() => {
    const filterByStatus = (r: ApplicationRow) => (status === "all" ? true : r.status === status);
    const filterBySearch = (r: ApplicationRow) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.company.toLowerCase().includes(q) || r.role.toLowerCase().includes(q) || r.location.toLowerCase().includes(q);
    };
    const matched = rows.filter((r) => filterByStatus(r) && filterBySearch(r));
    return {
      visible: matched.filter((r) => !HIDDEN_STATUSES.has(r.status)),
      hidden: matched.filter((r) => HIDDEN_STATUSES.has(r.status)),
    };
  }, [rows, status, search]);

  return (
    <div className="flex flex-col gap-5">
      <Toolbar total={rows.length} shown={visible.length + (showHidden ? hidden.length : 0)} />

      <TableBucket rows={visible} sorting={sorting} isArrival={isArrival} />

      {hidden.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => applicationsView$.showHidden.set(!showHidden)}
            className="inline-flex items-center gap-2 uppercase text-text-secondary transition-colors hover:text-text-primary"
          >
            <span className={cn("inline-block transition-transform", showHidden && "rotate-90")}>▸</span>
            {showHidden ? "Hide" : "Show"} {hidden.length} ghosted / rejected
          </button>
          {showHidden && (
            <div className="mt-3 opacity-70">
              <TableBucket rows={hidden} sorting={sorting} isArrival={isArrival} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toolbar({ total, shown }: { total: number; shown: number }) {
  const search = useSelector(applicationsView$.search);
  const status = useSelector(applicationsView$.status);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-0 flex-1 basis-40 sm:min-w-52 sm:max-w-sm">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">{">"}</span>
        <Input
          value={search}
          onChange={(e) => applicationsView$.search.set(e.target.value)}
          placeholder="search company, role, location…"
          className="pl-7 font-mono text-[12.5px] normal-case tracking-normal"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="medium">
            <span className="text-text-tertiary">Status:</span>
            {status}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 font-mono uppercase tracking-[0.04em]">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_FILTERS.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => applicationsView$.status.set(s)}>
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="ml-auto tabular-nums text-text-tertiary">
        {shown} of {total}
      </span>
    </div>
  );
}

function TableBucket({
  rows,
  sorting,
  isArrival,
}: {
  rows: ApplicationRow[];
  sorting: any;
  isArrival: (id: string) => boolean;
}) {
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (updater) => applicationsView$.sorting.set(typeof updater === "function" ? updater(sorting) : updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (rows.length === 0) {
    return <div className="border border-dashed border-stroke-primary py-10 text-center text-text-tertiary">No matches for this view.</div>;
  }

  return (
    <>
      {/* Stacked cards below `sm` — a fixed-column grid can't fit five columns on a phone. */}
      <div className="flex flex-col sm:hidden">
        {table.getRowModel().rows.map((row) => (
          <MobileCard key={row.id} app={row.original} arrived={isArrival(row.original.id)} />
        ))}
      </div>

      {/* Grid table, `sm` and up. */}
      <div className="-mx-1 hidden overflow-x-auto sm:block">
        <div className="min-w-[640px]">
          {table.getHeaderGroups().map((group) => (
            <div key={group.id} className={cn("grid items-center gap-4 border-b border-dashed border-white/15 px-1 pb-2 text-text-tertiary", GRID_COLS)}>
              {group.headers.map((header) => (
                <div key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</div>
              ))}
            </div>
          ))}

          {table.getRowModel().rows.map((row) => (
            <MotionLink
              key={row.original.id}
              to={`/applications/${row.original.id}`}
              layout="position"
              {...(isArrival(row.original.id) ? ARRIVE : { initial: false })}
              className={cn(
                isArrival(row.original.id) && "arrive",
                "group grid items-center gap-4 border-b border-stroke-secondary px-1 py-3 transition-colors last:border-0 hover:bg-text-primary",
                row.original.unread && "shadow-[inset_2px_0_0_var(--color-green-primary)]",
                GRID_COLS,
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className="min-w-0">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </MotionLink>
          ))}
        </div>
      </div>
    </>
  );
}

function MobileCard({ app, arrived }: { app: ApplicationRow; arrived: boolean }) {
  return (
    <MotionLink
      to={`/applications/${app.id}`}
      layout="position"
      {...(arrived ? ARRIVE : { initial: false })}
      className={cn(
        arrived && "arrive",
        "group flex flex-col gap-2 border-b border-stroke-secondary px-1 py-3 transition-colors last:border-0 hover:bg-text-primary hover:text-text-inverse",
        app.unread && "pl-3 shadow-[inset_2px_0_0_var(--color-green-primary)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-text-primary group-hover:!text-text-inverse">{app.company}</span>
            <UnreadMark count={app.unread} />
          </p>
          <p className="mt-0.5 truncate text-text-secondary group-hover:!text-text-inverse/80">{app.role}</p>
        </div>
        <StatusBadge status={app.status} className="shrink-0 group-hover:!text-text-inverse" />
      </div>
      <div className="flex items-center gap-2 text-text-tertiary group-hover:!text-text-inverse/60">
        <span>{app.cvType}</span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums">{fmtDate(app.appliedAt)}</span>
        {app.location && (
          <>
            <span className="opacity-50">·</span>
            <span className="min-w-0 truncate">{app.location}</span>
          </>
        )}
      </div>
    </MotionLink>
  );
}

function UnreadMark({ count }: { count?: number }) {
  if (!count) return null;
  return <NewBadge count={count} className="self-center" />;
}
