import { useSelector } from "@legendapp/state/react";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
        className="top-[16%] max-w-2xl translate-y-0 gap-0 overflow-hidden border border-stroke-primary bg-sidebar-active p-0 font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
        onPointerDown={(e) => {
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== "BUTTON" && tag !== "INPUT") inputRef.current?.focus();
        }}
      >
        <DialogTitle id={titleId} className="sr-only">
          Search job tracker
        </DialogTitle>
        <DialogDescription id={descriptionId} className="sr-only">
          Search saved and applied jobs, matched emails, and pages
        </DialogDescription>

        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.5} className="shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, emails and pages"
            className="flex-1 bg-transparent text-[16px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="cursor-pointer p-1 text-text-tertiary transition-colors hover:bg-ink/[0.05] hover:text-text-primary"
              aria-label="Clear search"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 border-b border-stroke-secondary px-4 pb-3">
          {(["all", "jobs", "emails", "nav"] as SearchScope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                commandPalette$.scope.set(s);
                inputRef.current?.focus();
              }}
              className={cn(
                "h-8 cursor-pointer select-none px-3 text-[13px] font-medium transition-colors",
                scope === s
                  ? "bg-ink/[0.07] text-text-primary"
                  : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
              )}
            >
              {SCOPE_LABELS[s]}
            </button>
          ))}
          {loading && <span className="ml-auto animate-pulse text-[12.5px] text-text-tertiary">Searching…</span>}
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

        <div className="flex items-center gap-5 border-t border-stroke-secondary bg-sidebar px-5 py-2.5 text-[12.5px] text-text-tertiary">
          <Hint keys={["↑", "↓"]}>to move</Hint>
          <Hint keys={["↵"]}>to open</Hint>
          <Hint keys={["Esc"]}>to close</Hint>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SCOPE_LABELS: Record<SearchScope, string> = { all: "All", jobs: "Jobs", emails: "Emails", nav: "Pages" };

function Hint({ keys, children }: { keys: string[]; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((k) => (
        <kbd key={k} className="min-w-5 border border-stroke-primary bg-sidebar-active px-1 text-center font-sans text-[11.5px] text-text-secondary">
          {k}
        </kbd>
      ))}
      {children}
    </span>
  );
}
