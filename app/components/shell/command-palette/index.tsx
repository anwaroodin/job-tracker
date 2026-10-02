import { useSelector } from "@legendapp/state/react";
import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/cn";
import { commandPalette$, type SearchScope } from "~/lib/state/command-palette";
import { NAV_ITEMS, type SelectableItem } from "./items";
import { PaletteResults } from "./results";
import { useSearch } from "./use-search";

export function CommandPalette() {
  const open = useSelector(commandPalette$.open);
  const scope = useSelector(commandPalette$.scope);
  const navigate = useNavigate();

  const { query, setQuery, loading, data } = useSearch(open);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Global Ctrl+K / Cmd+K opener listener
  useEffect(() => {
    const handleGlobalOpen = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        commandPalette$.open.set(!commandPalette$.open.get());
      }
    };
    window.addEventListener("keydown", handleGlobalOpen);
    return () => window.removeEventListener("keydown", handleGlobalOpen);
  }, []);

  // Filter items according to scope
  const filteredNav = (scope === "all" || scope === "nav")
    ? NAV_ITEMS.filter((n) =>
        query ? n.label.toLowerCase().includes(query.toLowerCase()) || n.hint.toLowerCase().includes(query.toLowerCase()) : true
      )
    : [];

  const filteredApps = (scope === "all" || scope === "jobs") ? data.applications : [];
  const filteredEmails = (scope === "all" || scope === "emails") ? data.emails : [];

  const allSelectables: SelectableItem[] = [
    ...filteredNav.map((n) => ({ type: "nav" as const, item: n })),
    ...filteredApps.map((a) => ({ type: "app" as const, item: a })),
    ...filteredEmails.map((e) => ({ type: "email" as const, item: e })),
  ];

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, scope, allSelectables.length]);

  // Auto-scroll selected item into view inside the results container
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const close = () => commandPalette$.open.set(false);

  const activate = (item: SelectableItem) => {
    close();
    if (item.type === "nav") {
      navigate(item.item.to);
    } else if (item.type === "app") {
      navigate(`/applications/${item.item.id}`);
    } else if (item.type === "email") {
      navigate(`/applications/${item.item.applicationId}`);
    }
  };

  // Keyboard navigation listener while open:
  // Using capture phase to intercept ArrowUp/ArrowDown so the background page NEVER scrolls!
  useEffect(() => {
    if (!open) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (allSelectables.length ? (i + 1) % allSelectables.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => (allSelectables.length ? (i - 1 + allSelectables.length) % allSelectables.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (allSelectables[selectedIndex]) {
          activate(allSelectables[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };

    window.addEventListener("keydown", handleKeyDownCapture, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDownCapture, { capture: true });
  }, [open, selectedIndex, allSelectables]);

  return (
    <Dialog open={open} onOpenChange={(val) => commandPalette$.open.set(val)}>
      <DialogContent
        hideClose
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="top-[18%] max-w-2xl translate-y-0 gap-0 overflow-hidden border border-stroke-primary bg-bg-secondary p-0 font-mono text-[12.5px] shadow-[0_24px_60px_rgba(0,0,0,0.9)]"
        onPointerDown={(e) => {
          if (
            (e.target as HTMLElement).tagName !== "BUTTON" &&
            (e.target as HTMLElement).tagName !== "INPUT"
          ) {
            inputRef.current?.focus();
          }
        }}
      >
        <DialogTitle id={titleId} className="sr-only">
          Search job tracker
        </DialogTitle>
        <DialogDescription id={descriptionId} className="sr-only">
          Search saved and applied jobs, matched emails, and pages
        </DialogDescription>

        {/* Search bar input */}
        <div className="flex items-center gap-3 border-b border-stroke-secondary px-4 py-3.5">
          <Search className="size-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved & applied jobs, emails, pages…"
            className="flex-1 bg-transparent font-mono text-[13px] normal-case text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-text-tertiary transition-colors hover:text-text-primary cursor-pointer"
              aria-label="Clear query"
            >
              <X className="size-3.5" />
            </button>
          )}
          <kbd className="hidden rounded border border-stroke-secondary px-1.5 py-0.5 text-[10px] text-text-tertiary sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Scope filter tabs */}
        <div className="flex items-center gap-1.5 border-b border-stroke-secondary/60 bg-bg-primary/50 px-4 py-2 text-[11px] uppercase tracking-[0.06em]">
          <span className="mr-2 text-text-tertiary">Scope:</span>
          {(["all", "jobs", "emails", "nav"] as SearchScope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                commandPalette$.scope.set(s);
                inputRef.current?.focus();
              }}
              className={cn(
                "px-2 py-0.5 transition-colors cursor-pointer select-none",
                scope === s
                  ? "bg-text-primary text-text-inverse font-semibold"
                  : "text-text-tertiary hover:bg-fill-secondary hover:text-text-primary"
              )}
            >
              {s === "all" ? "All" : s === "jobs" ? "Jobs" : s === "emails" ? "Emails" : "Pages"}
            </button>
          ))}
          {loading && <span className="ml-auto text-[10px] text-text-tertiary animate-pulse">Searching…</span>}
        </div>

        <PaletteResults
          query={query}
          filteredNav={filteredNav}
          filteredApps={filteredApps}
          filteredEmails={filteredEmails}
          allSelectables={allSelectables}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          activeItemRef={activeItemRef}
          activate={activate}
        />

        {/* Footer keyboard shortcuts hint */}
        <div className="flex items-center justify-between border-t border-stroke-secondary/60 bg-bg-primary/70 px-4 py-2 text-[10.5px] text-text-tertiary">
          <div className="flex items-center gap-3">
            <span><kbd className="border border-stroke-secondary px-1">↑↓</kbd> navigate</span>
            <span><kbd className="border border-stroke-secondary px-1">↵</kbd> select</span>
            <span><kbd className="border border-stroke-secondary px-1">esc</kbd> close</span>
          </div>
          <span>job-tracker search</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
