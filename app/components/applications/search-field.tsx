import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/cn";
import type { ApplicationsView } from "./use-applications-view";

export function SearchField({ view, className }: { view: ApplicationsView; className?: string }) {
  const { search, setSearch, setPage, searchInputRef } = view;
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <HugeiconsIcon
        icon={Search01Icon}
        size={16}
        strokeWidth={1.5}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
      />
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
        placeholder="Search company or role"
        aria-label="Search applications"
        className="h-9 pl-8 pr-8 text-[13.5px]"
      />
      {search ? (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            searchInputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 text-text-tertiary transition-colors hover:text-text-primary"
          aria-label="Clear search"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.5} />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 bg-ink/[0.06] px-1.5 font-sans text-[11.5px] text-text-tertiary">
          /
        </kbd>
      )}
    </div>
  );
}
