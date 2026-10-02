import { useEffect, useMemo, useRef, useState } from "react";
import { ACTIVE_STATUSES, OFFER_STATUSES } from "~/lib/status";
import type { ApplicationRowData } from "~/types/application";

export const PAGE_SIZE = 15;
const HIDDEN = new Set(["rejected", "ghosted", "withdrawn"]);

const STATUS_PRIORITY: Record<string, number> = {
  offer: 1,
  accepted: 2,
  interview: 3,
  assessment: 4,
  screening: 5,
  applied: 6,
  ghosted: 7,
  rejected: 8,
  withdrawn: 9,
};

export type TabKey = "active" | "offers" | "closed" | "all";
export type SortKey = "company" | "role" | "status" | "appliedAt";
export type SortDir = "asc" | "desc";

export function useApplicationsView(rows: ApplicationRowData[]) {
  const total = rows.length;
  const activeCount = rows.filter((r) => ACTIVE_STATUSES.has(r.status)).length;
  const offersList = rows.filter((r) => OFFER_STATUSES.has(r.status));
  const offersCount = offersList.length;
  const closedCount = rows.filter((r) => HIDDEN.has(r.status)).length;

  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortKey>("appliedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global '/' shortcut to focus search, and Escape to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tabs: { key: TabKey; label: string; count: number; highlight?: boolean }[] = [
    { key: "active", label: "Active", count: activeCount },
    { key: "offers", label: "Offers", count: offersCount, highlight: offersCount > 0 },
    { key: "closed", label: "Closed", count: closedCount },
    { key: "all", label: "All", count: total },
  ];

  const handleSortToggle = (col: SortKey) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "appliedAt" ? "desc" : "asc");
    }
    setPage(0);
  };

  const resetAllFilters = () => {
    setActiveTab("active");
    setSearch("");
    setSortCol("appliedAt");
    setSortDir("desc");
    setPage(0);
    searchInputRef.current?.focus();
  };

  const hasActiveFilters = activeTab !== "active" || search.trim() !== "";

  // Filter and multi-column sort
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    return rows
      .filter((r) => {
        // Tab filter
        if (activeTab === "active" && !ACTIVE_STATUSES.has(r.status)) return false;
        if (activeTab === "offers" && !OFFER_STATUSES.has(r.status)) return false;
        if (activeTab === "closed" && !HIDDEN.has(r.status)) return false;

        // Search query filter across company, role, location
        if (!q) return true;
        return (
          r.company.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          (r.location && r.location.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortCol === "company") {
          cmp = a.company.localeCompare(b.company);
        } else if (sortCol === "role") {
          cmp = a.role.localeCompare(b.role);
        } else if (sortCol === "status") {
          const pA = STATUS_PRIORITY[a.status] ?? 99;
          const pB = STATUS_PRIORITY[b.status] ?? 99;
          cmp = pA - pB;
        } else {
          const timeA = new Date(a.appliedAt).getTime() || 0;
          const timeB = new Date(b.appliedAt).getTime() || 0;
          cmp = timeA - timeB;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [rows, activeTab, search, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedItems = filteredItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return {
    total,
    activeCount,
    offersList,
    offersCount,
    closedCount,
    tabs,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    sortCol,
    sortDir,
    setPage,
    searchInputRef,
    handleSortToggle,
    resetAllFilters,
    hasActiveFilters,
    filteredItems,
    totalPages,
    currentPage,
    paginatedItems,
  };
}

export type ApplicationsView = ReturnType<typeof useApplicationsView>;
