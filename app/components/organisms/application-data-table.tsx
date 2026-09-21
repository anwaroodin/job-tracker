import { useSelector } from "@legendapp/state/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Search,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/atoms/table";
import { StatusBadge } from "~/components/molecules/status-badge";
import { applicationsView$ } from "~/lib/state/applications-view";
import type { Application } from "~/server/db/schema";
import { cn } from "~/lib/cn";

const HIDDEN_STATUSES = new Set(["rejected", "ghosted"]);
const STATUS_FILTERS = [
  "all",
  "applied",
  "interview",
  "offer",
  "rejected",
  "ghosted",
] as const;

function SortIcon({ dir }: { dir: false | "asc" | "desc" }) {
  if (dir === "asc") return <ChevronUp className="size-3" />;
  if (dir === "desc") return <ChevronDown className="size-3" />;
  return <ChevronsUpDown className="size-3 opacity-40" />;
}

const columns: ColumnDef<Application>[] = [
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => (
      <div>
        <Link
          to={`/applications/${row.original.id}`}
          className="font-medium text-text-primary transition-colors hover:text-text-secondary"
        >
          {row.original.company}
        </Link>
        {row.original.location && (
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {row.original.location}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => (
      <span className="text-[13px] text-text-primary">{row.original.role}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "cvType",
    header: "CV",
    cell: ({ row }) => (
      <span className="text-[11px] uppercase tracking-wider text-text-secondary">
        {row.original.cvType}
      </span>
    ),
  },
  {
    accessorKey: "appliedAt",
    header: ({ column }) => (
      <button
        type="button"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-text-tertiary transition-colors hover:text-text-primary"
      >
        Applied
        <SortIcon dir={column.getIsSorted()} />
      </button>
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-[13px] text-text-secondary">
        {new Date(row.original.appliedAt).toLocaleDateString()}
      </span>
    ),
  },
];

export function ApplicationDataTable({ rows }: { rows: Application[] }) {
  const search = useSelector(applicationsView$.search);
  const status = useSelector(applicationsView$.status);
  const sorting = useSelector(applicationsView$.sorting);
  const showHidden = useSelector(applicationsView$.showHidden);

  // Split rows before feeding TanStack — visible bucket + hidden (ghosted/rejected).
  const { visible, hidden } = useMemo(() => {
    const filterByStatus = (r: Application) =>
      status === "all" ? true : r.status === status;
    const filterBySearch = (r: Application) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.company.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      );
    };
    const matched = rows.filter((r) => filterByStatus(r) && filterBySearch(r));
    return {
      visible: matched.filter((r) => !HIDDEN_STATUSES.has(r.status)),
      hidden: matched.filter((r) => HIDDEN_STATUSES.has(r.status)),
    };
  }, [rows, status, search]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        total={rows.length}
        shown={visible.length + (showHidden ? hidden.length : 0)}
      />

      <TableBucket rows={visible} sorting={sorting} />

      {hidden.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => applicationsView$.showHidden.set(!showHidden)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                showHidden && "rotate-90",
              )}
            />
            {showHidden ? "Hide" : "Show"} {hidden.length} ghosted / rejected
          </button>
          {showHidden && (
            <div className="mt-2 opacity-80">
              <TableBucket rows={hidden} sorting={sorting} />
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-52 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
        <Input
          value={search}
          onChange={(e) => applicationsView$.search.set(e.target.value)}
          placeholder="Search company, role, location…"
          className="pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="medium">
            <span className="text-text-secondary">Status:</span>
            <span className="capitalize">{status}</span>
            <ChevronDown className="size-3 text-text-tertiary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_FILTERS.map((s) => (
            <DropdownMenuItem
              key={s}
              onSelect={() => applicationsView$.status.set(s)}
              className="capitalize"
            >
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="ml-auto text-[11px] text-text-tertiary tabular-nums">
        {shown} of {total}
      </span>
    </div>
  );
}

function TableBucket({ rows, sorting }: { rows: Application[]; sorting: any }) {
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (updater) =>
      applicationsView$.sorting.set(
        typeof updater === "function" ? updater(sorting) : updater,
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="border-y border-stroke-secondary py-10 text-center text-[13px] text-text-tertiary">
        No applications match this view.
      </div>
    );
  }

  return (
    <div className="border-y border-stroke-secondary [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
