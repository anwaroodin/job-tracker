import { useSelector } from "@legendapp/state/react";
import { ArrowRight, Compass, Mail, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/atoms/dialog";
import { StatusBadge } from "~/components/molecules/status-badge";
import { fmtDate } from "~/components/molecules/terminal";
import { cn } from "~/lib/cn";
import { commandPalette$, type SearchScope } from "~/lib/state/command-palette";
import type { SearchApplicationItem, SearchEmailItem, SearchResults } from "~/server/db/search.server";

const NAV_ITEMS = [
  { id: "nav-overview", label: "Overview", to: "/overview", hint: "Dashboard summary & readout" },
  { id: "nav-applications", label: "Applications", to: "/applications", hint: "All saved & logged applications" },
  { id: "nav-profile", label: "Profile", to: "/profile", hint: "Personal info, CVs & integrations" },
  { id: "nav-usage", label: "Usage", to: "/usage", hint: "Spend & classification metrics" },
  { id: "nav-settings", label: "Settings", to: "/settings", hint: "Preferences & sync settings" },
];

export function CommandPalette() {
  const open = useSelector(commandPalette$.open);
  const scope = useSelector(commandPalette$.scope);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResults>({ applications: [], emails: [] });
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

  // Fetch search results with debouncing
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = (await res.json()) as SearchResults;
          setData(json);
        }
      } catch (err) {
        console.error("Search fetch failed", err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [open, query]);

  // Filter items according to scope
  const filteredNav = (scope === "all" || scope === "nav")
    ? NAV_ITEMS.filter((n) =>
        query ? n.label.toLowerCase().includes(query.toLowerCase()) || n.hint.toLowerCase().includes(query.toLowerCase()) : true
      )
    : [];

  const filteredApps = (scope === "all" || scope === "jobs") ? data.applications : [];
  const filteredEmails = (scope === "all" || scope === "emails") ? data.emails : [];

  // Flat list of selectable items for keyboard navigation
  type SelectableItem =
    | { type: "nav"; item: (typeof NAV_ITEMS)[number] }
    | { type: "app"; item: SearchApplicationItem }
    | { type: "email"; item: SearchEmailItem };

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

        {/* Results list */}
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
