import { ArrowRight, Compass, Mail } from "lucide-react";
import type { RefObject } from "react";
import { StatusBadge } from "~/components/ui/status-badge";
import { fmtDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { SearchApplicationItem, SearchEmailItem } from "~/types/search";
import type { NAV_ITEMS, SelectableItem } from "./items";

export function PaletteResults({
  query,
  filteredNav,
  filteredApps,
  filteredEmails,
  allSelectables,
  selectedIndex,
  setSelectedIndex,
  activeItemRef,
  activate,
}: {
  query: string;
  filteredNav: (typeof NAV_ITEMS)[number][];
  filteredApps: SearchApplicationItem[];
  filteredEmails: SearchEmailItem[];
  allSelectables: SelectableItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  activeItemRef: RefObject<HTMLDivElement | null>;
  activate: (item: SelectableItem) => void;
}) {
  return (
    <div className="max-h-[380px] overflow-y-auto p-2">
      {allSelectables.length === 0 ? (
        <div className="py-12 text-center text-text-tertiary">
          <p>No results found for “{query}”.</p>
          <p className="mt-1 text-[11px]">Try adjusting your search terms or scope filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Pages section */}
          {filteredNav.length > 0 && (
            <div className="mb-2">
              <p className="px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                Navigation
              </p>
              {filteredNav.map((item) => {
                const itemIndex = allSelectables.findIndex(
                  (s) => s.type === "nav" && s.item.id === item.id
                );
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={item.id}
                    ref={isSelected ? activeItemRef : undefined}
                    onClick={() => activate({ type: "nav", item })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 transition-colors",
                      isSelected
                        ? "bg-fill-tertiary text-text-primary ring-1 ring-stroke-primary"
                        : "text-text-secondary hover:bg-fill-secondary hover:text-text-primary"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Compass className="size-3.5 shrink-0 text-text-tertiary" />
                      <span className="font-semibold text-text-primary">{item.label}</span>
                      <span className="truncate text-[11px] text-text-tertiary">{item.hint}</span>
                    </div>
                    <ArrowRight className="size-3 shrink-0 text-text-tertiary" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Jobs section */}
          {filteredApps.length > 0 && (
            <div className="mb-2">
              <p className="px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                Applications ({filteredApps.length})
              </p>
              {filteredApps.map((item) => {
                const itemIndex = allSelectables.findIndex(
                  (s) => s.type === "app" && s.item.id === item.id
                );
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={item.id}
                    ref={isSelected ? activeItemRef : undefined}
                    onClick={() => activate({ type: "app", item })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 px-2.5 py-2 transition-colors",
                      isSelected
                        ? "bg-fill-tertiary text-text-primary ring-1 ring-stroke-primary"
                        : "text-text-secondary hover:bg-fill-secondary hover:text-text-primary"
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="font-semibold text-text-primary">{item.company}</span>
                      <span className="truncate text-text-secondary">/ {item.role}</span>
                      {item.location && (
                        <span className="hidden truncate text-[10.5px] text-text-tertiary sm:inline">
                          · {item.location}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[10px] tabular-nums text-text-tertiary">
                        {fmtDate(item.appliedAt)}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Emails section */}
          {filteredEmails.length > 0 && (
            <div>
              <p className="px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
                Emails ({filteredEmails.length})
              </p>
              {filteredEmails.map((item) => {
                const itemIndex = allSelectables.findIndex(
                  (s) => s.type === "email" && s.item.id === item.id
                );
                const isSelected = itemIndex === selectedIndex;
                return (
                  <div
                    key={item.id}
                    ref={isSelected ? activeItemRef : undefined}
                    onClick={() => activate({ type: "email", item })}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 px-2.5 py-2 transition-colors",
                      isSelected
                        ? "bg-fill-tertiary text-text-primary ring-1 ring-stroke-primary"
                        : "text-text-secondary hover:bg-fill-secondary hover:text-text-primary"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Mail className="size-3.5 shrink-0 text-text-tertiary" />
                        <span className="truncate font-medium text-text-primary">
                          {item.subject || "(No subject)"}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-text-tertiary">
                        {fmtDate(item.receivedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-5.5 text-[11px] text-text-tertiary">
                      <span className="truncate max-w-[200px]">{item.fromAddress}</span>
                      <span>·</span>
                      <span className="font-semibold text-text-secondary truncate">
                        {item.company} {item.role ? `· ${item.role}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
