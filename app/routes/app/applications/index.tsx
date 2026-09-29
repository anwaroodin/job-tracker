import { data, redirect, Link, useFetcher, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/index";
import type { loader as layoutLoader } from "../layout";
import { useState, useMemo, useRef, useEffect } from "react";
import { ApplicationSuggestions } from "~/components/organisms/application-suggestions";
import { NewApplication } from "~/components/organisms/new-application";
import { GmailSync } from "~/components/molecules/gmail-sync";
import { Section, fmtDate, stagger } from "~/components/molecules/terminal";
import { Input } from "~/components/atoms/input";
import { Button } from "~/components/atoms/button";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { createApplication, listApplications, settleSavedJob } from "~/server/db/applications.server";
import {
  applicationSuggestions,
  dismissSuggestions,
  linkEmailsToApplication,
  unreadEmailCounts,
} from "~/server/db/emails.server";
import { refreshApplicationStatus, syncGmail } from "~/server/gmail/sync.server";
import { useArrivals } from "~/lib/use-arrivals";
import { cn } from "~/lib/cn";
import { X } from "lucide-react";
import {
  ApplicationRowItem,
  APPLICATION_ROW_GRID_COLS,
  SAVED_APPLICATION_ROW_GRID_COLS,
  type ApplicationRow,
  type SavedJobData,
} from "~/components/molecules/application-row";

const MAX_FIELD_LENGTH = 200;
const HIDDEN = new Set(["rejected", "ghosted", "withdrawn"]);
const ACTIVE = new Set(["applied", "screening", "interview", "assessment"]);
const OFFERED = new Set(["offer", "accepted"]);
const PAGE_SIZE = 15;

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

type TabKey = "active" | "offers" | "closed" | "all";
type SortKey = "company" | "role" | "status" | "appliedAt";
type SortDir = "asc" | "desc";
type SavedJob = SavedJobData;

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [apps, unread, suggestions] = await Promise.all([
    listApplications(db, user.id),
    unreadEmailCounts(db, user.id),
    applicationSuggestions(db, user.id),
  ]);
  const saved = apps.filter((a) => a.status === "saved");
  const rows = apps.filter((a) => a.status !== "saved").map((a) => ({ ...a, unread: unread[a.id] ?? 0 }));
  return { rows, saved, suggestions, accountEmail: user.email };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
  const db = getDb(env.DB);
  const emailIds = String(form.get("emailIds") ?? "").split(",").filter(Boolean);

  if (intent === "saved-applied" || intent === "saved-remove") {
    const applicationId = String(form.get("applicationId") ?? "");
    const outcome = intent === "saved-remove" ? "removed" : "applied";
    if (!(await settleSavedJob(db, user.id, applicationId, outcome))) return { error: "Not a saved posting" };
    return { ok: true };
  }
  if (intent === "dismiss-suggestion") {
    await dismissSuggestions(db, user.id, emailIds);
    return { ok: true };
  }
  if (intent === "link-suggestion") {
    const applicationId = String(form.get("applicationId") ?? "");
    await linkEmailsToApplication(db, user.id, applicationId, emailIds);
    await refreshApplicationStatus(db, user.id, applicationId);
    return { ok: true };
  }

  if (intent !== "create" && intent !== "track") throw data("Unknown intent", { status: 400 });
  const company = String(form.get("company") ?? "").trim().slice(0, MAX_FIELD_LENGTH);
  const role = String(form.get("role") ?? "").trim().slice(0, MAX_FIELD_LENGTH);
  if (!company || !role) return { error: "Company and role are required" };
  const appliedAt = new Date(String(form.get("appliedAt") ?? ""));
  const id = crypto.randomUUID();
  await createApplication(db, {
    id,
    userId: user.id,
    company,
    role,
    autoFilled: false,
    ...(intent === "track" && !Number.isNaN(appliedAt.getTime()) ? { appliedAt: appliedAt.toISOString() } : {}),
  });
  if (intent === "create") return redirect(`/applications/${id}`);
  await linkEmailsToApplication(db, user.id, id, emailIds);
  await refreshApplicationStatus(db, user.id, id);
  return { ok: true };
}

export default function Applications({ loaderData }: Route.ComponentProps) {
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const rows = loaderData.rows;
  const saved = loaderData.saved;
  const suggestions = loaderData.suggestions;

  const total = rows.length;
  const activeCount = rows.filter((r) => ACTIVE.has(r.status)).length;
  const offersList = rows.filter((r) => OFFERED.has(r.status));
  const offersCount = offersList.length;
  const closedCount = rows.filter((r) => HIDDEN.has(r.status)).length;
  const savedCount = saved.length;

  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortKey>("appliedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const isArrival = useArrivals([
    ...rows.map((r) => r.id),
    ...saved.map((s) => s.id),
  ]);

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
        if (activeTab === "active" && !ACTIVE.has(r.status)) return false;
        if (activeTab === "offers" && !OFFERED.has(r.status)) return false;
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

  return (
    <div className="flex flex-col gap-6 sm:gap-8 font-mono text-[12.5px] uppercase tracking-[0.04em]">
      {/* ── [01] Applications Header ──────────────────────────────────────────── */}
      <header className="rise flex flex-wrap items-end justify-between gap-4 sm:gap-6" style={stagger(0)}>
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[01]</b>
            Applications
          </p>
          <h1 className="mt-3 sm:mt-5 max-w-2xl text-[22px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
            <span className="text-text-primary">{total} applications logged.</span>
            <span className="block text-text-tertiary">
              {activeCount} in flight, {offersCount} {offersCount === 1 ? "offer" : "offers"},{" "}
              {closedCount} closed.
            </span>
          </h1>
        </div>

        {/* Action cluster on the right */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto sm:ml-auto">
          <GmailSync status={gmail} />
          <NewApplication />
        </div>
      </header>

      {/* ── Offer Spotlight Banner (celebrates active offers so they are NEVER missed!) ── */}
      {offersCount > 0 && (
        <div className="relative overflow-hidden border border-green-primary/45 bg-green-primary/10 px-4 py-3 sm:px-5 sm:py-3.5">
          {/* Header row with status, counter, and action required notice */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-primary/25 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-2 rounded-full bg-green-primary animate-pulse" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-green-primary">
                Offer Milestone
              </span>
              <span className="text-green-primary/40 font-mono">/</span>
              <span className="font-sans text-[12px] normal-case text-text-primary">
                {offersCount === 1
                  ? "1 active offer received"
                  : `${offersCount} active offers received`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-green-primary/90 font-medium">
                Action required
              </span>
            </div>
          </div>

          {/* Clean, high-density terminal offer rows */}
          <div className="divide-y divide-dashed divide-green-primary/25">
            {offersList.map((offer) => (
              <Link
                key={offer.id}
                to={`/applications/${offer.id}`}
                className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 transition-colors hover:bg-green-primary/10 -mx-2 px-2 rounded-xs"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono font-semibold text-[13.5px] text-text-primary group-hover:text-green-primary transition-colors">
                    {offer.company}
                  </span>
                  <span className="truncate font-sans text-[12.5px] text-text-secondary normal-case">
                    {offer.role}
                  </span>
                  {offer.salary && (
                    <span className="font-mono text-[10.5px] font-medium text-green-primary bg-green-primary/15 border border-green-primary/30 px-1.5 py-0.5 rounded-xs">
                      {offer.salary}
                    </span>
                  )}
                  {offer.location && (
                    <span className="hidden font-mono text-[11px] text-text-tertiary sm:inline">
                      · {offer.location}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10.5px] text-text-tertiary">
                    Received {fmtDate(offer.appliedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-green-primary font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>View offer</span>
                    <span>→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Optional Inbox Suggestions Banner ─────────────────────── */}
      {suggestions.length > 0 && (
        <div className="border border-dashed border-accent-tertiary bg-accent-quaternary/20 px-3.5 py-2.5 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-accent-primary">
              <span className="size-1.5 rounded-full bg-accent-primary animate-pulse" />
              <span>
                {suggestions.length} untracked {suggestions.length === 1 ? "application" : "applications"} detected in your Gmail
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSuggestions((s) => !s)}
              className="font-mono text-text-primary transition-colors hover:text-accent-secondary cursor-pointer"
            >
              {showSuggestions ? "[Hide suggestions ▲]" : "[Review suggestions ▼]"}
            </button>
          </div>
          {showSuggestions && (
            <div className="mt-4 pt-4 border-t border-dashed border-accent-tertiary/50">
              <ApplicationSuggestions
                suggestions={suggestions}
                accountEmail={loaderData.accountEmail}
              />
            </div>
          )}
        </div>
      )}

      {/* ── [02] Dedicated Saved Jobs Section (prominent so users never forget them!) ── */}
      <Section
        n="02"
        title="Saved jobs"
        hint={savedCount > 0 ? `${savedCount} to apply` : undefined}
        i={1}
      >
        {savedCount === 0 ? (
          <div className="border border-dashed border-stroke-secondary px-4 py-8 text-center text-text-tertiary">
            <p className="text-[12px] font-mono">No saved jobs pending.</p>
            <p className="mt-1 font-sans text-[12px] text-text-tertiary/80 normal-case">
              Bookmark job postings using the Chrome extension or star them to follow up later.
            </p>
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <div className="w-full min-w-0 sm:min-w-[640px]">
              {/* Header Row (Desktop only) */}
              <div
                className={cn(
                  "hidden sm:grid items-center gap-4 border-b border-dashed border-white/15 px-3 pb-2.5 text-[10.5px] text-text-tertiary",
                  SAVED_APPLICATION_ROW_GRID_COLS
                )}
              >
                <span>Company</span>
                <span>Role</span>
                <span>Saved</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Rows */}
              {saved.map((job) => (
                <ApplicationRowItem
                  key={job.id}
                  variant="saved"
                  job={job}
                  arrived={isArrival(job.id)}
                  confirmRemove
                />
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── [03] Tracked Applications Section ───────────────── */}
      <Section
        n="03"
        title="Tracked applications"
        hint={`${filteredItems.length} matching`}
        i={2}
      >
        <div className="flex flex-col gap-4">
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

          {/* Table Container */}
          <div className="-mx-1 overflow-x-auto">
            <div className="w-full min-w-0 sm:min-w-[640px]">
              {/* Header Row with Sortable Columns (Desktop only) */}
              <div
                className={cn(
                  "hidden sm:grid items-center gap-4 border-b border-dashed border-white/15 px-3 pb-2.5 text-[10.5px] text-text-tertiary",
                  APPLICATION_ROW_GRID_COLS
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSortToggle("company")}
                  className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary text-left cursor-pointer"
                >
                  <span>Company</span>
                  <SortIndicator column="company" current={sortCol} dir={sortDir} />
                </button>

                <button
                  type="button"
                  onClick={() => handleSortToggle("role")}
                  className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary text-left cursor-pointer"
                >
                  <span>Role</span>
                  <SortIndicator column="role" current={sortCol} dir={sortDir} />
                </button>

                <button
                  type="button"
                  onClick={() => handleSortToggle("status")}
                  className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary text-left cursor-pointer"
                >
                  <span>Status</span>
                  <SortIndicator column="status" current={sortCol} dir={sortDir} />
                </button>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSortToggle("appliedAt")}
                    className="inline-flex items-center gap-1.5 uppercase transition-colors hover:text-text-primary cursor-pointer"
                  >
                    <span>Applied</span>
                    <SortIndicator column="appliedAt" current={sortCol} dir={sortDir} />
                  </button>
                </div>
              </div>

              {/* Empty States */}
              {paginatedItems.length === 0 && (
                <div className="border border-dashed border-stroke-primary py-12 text-center text-text-tertiary px-4">
                  {total === 0 ? (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-[13px] text-text-primary">No applications logged yet.</p>
                      <p className="max-w-md font-sans text-[12px] normal-case tracking-normal text-text-secondary">
                        Start tracking your job search by adding an application manually or syncing directly with Gmail.
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <NewApplication />
                        <GmailSync status={gmail} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-[13px] text-text-primary">
                        No applications match your filter criteria.
                      </p>
                      <p className="font-sans text-[12px] normal-case tracking-normal text-text-secondary">
                        Try adjusting your search terms or clearing your current filters.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={resetAllFilters}
                        className="mt-1"
                      >
                        Reset filters
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Rows */}
              {paginatedItems.map((app) => (
                <ApplicationRowItem
                  key={app.id}
                  app={app}
                  arrived={isArrival(app.id)}
                />
              ))}
            </div>
          </div>

          {/* Minimal Terminal Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-white/15 pt-4 text-[11px] text-text-tertiary">
              <span>
                Showing {currentPage * PAGE_SIZE + 1}–
                {Math.min((currentPage + 1) * PAGE_SIZE, filteredItems.length)} of{" "}
                {filteredItems.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="border border-stroke-primary px-2.5 py-1 text-text-secondary transition-colors hover:bg-fill-primary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  ← Prev
                </button>
                <span className="px-2 font-mono">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  className="border border-stroke-primary px-2.5 py-1 text-text-secondary transition-colors hover:bg-fill-primary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function SortIndicator({
  column,
  current,
  dir,
}: {
  column: SortKey;
  current: SortKey;
  dir: SortDir;
}) {
  if (column !== current) {
    return <span className="text-[9px] opacity-30">◆</span>;
  }
  return <span className="text-[9px] text-text-primary">{dir === "asc" ? "▲" : "▼"}</span>;
}
