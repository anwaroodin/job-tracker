import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/cn";
import type { ApplicationsView } from "./use-applications-view";

export function TableToolbar({ view }: { view: ApplicationsView }) {
  const { tabs, activeTab, setActiveTab, setPage, search, setSearch, searchInputRef, hasActiveFilters, resetAllFilters } =
    view;
  return (
    <>
      {/* View Filter Tabs + Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-white/15 pb-4">
        {/* Terminal Segment Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(0);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.06em] transition-colors rounded-xs border cursor-pointer",
                  active
                    ? "border-text-primary bg-text-primary text-text-inverse font-semibold"
                    : "border-stroke-primary bg-fill-secondary text-text-secondary hover:border-stroke-secondary hover:text-text-primary"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[9.5px]",
                    active
                      ? "text-text-inverse/70"
                      : tab.highlight
                      ? "text-green-primary font-semibold"
                      : "text-text-tertiary"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick Search with Clear '×' and Shortcut '/' */}
        <div className="relative w-full sm:w-64">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary text-[11px]">
            &gt;
          </span>
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearch("");
                searchInputRef.current?.blur();
              }
            }}
            placeholder="search company, role…"
            className="h-8 pl-6 pr-8 font-mono text-[11.5px] normal-case tracking-normal"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 border border-stroke-secondary px-1 text-[10px] text-text-tertiary">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Active Filter Chips & Reset Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-text-tertiary">Filters:</span>
          {activeTab !== "active" && (
            <span className="inline-flex items-center gap-1 border border-stroke-secondary bg-fill-secondary px-2 py-0.5 text-text-primary">
              Status: {activeTab}
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className="ml-1 text-text-tertiary hover:text-text-primary cursor-pointer"
                aria-label="Remove tab filter"
              >
                ×
              </button>
            </span>
          )}
          {search.trim() !== "" && (
            <span className="inline-flex items-center gap-1 border border-stroke-secondary bg-fill-secondary px-2 py-0.5 text-text-primary normal-case">
              Search: &ldquo;{search}&rdquo;
              <button
                type="button"
                onClick={() => setSearch("")}
                className="ml-1 text-text-tertiary hover:text-text-primary cursor-pointer font-mono"
                aria-label="Remove search filter"
              >
                ×
              </button>
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="tiny"
            onClick={resetAllFilters}
            className="h-6 px-2 text-[10.5px] text-text-tertiary hover:text-text-primary"
          >
            Reset all
          </Button>
        </div>
      )}
    </>
  );
}
