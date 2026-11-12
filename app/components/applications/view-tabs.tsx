import { Link, useLocation, useRouteLoaderData, useSearchParams } from "react-router";
import type { loader } from "~/routes/app/applications/index";
import { cn } from "~/lib/cn";
import { CLOSED_TAB_STATUSES } from "./use-applications-view";

const VIEWS = ["open", "saved", "closed"] as const;
export type View = (typeof VIEWS)[number];

export function selectedView(params: URLSearchParams): View {
  const view = params.get("view");
  return VIEWS.includes(view as View) ? (view as View) : "open";
}

export function useApplicationViews() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const data = useRouteLoaderData<typeof loader>("routes/app/applications/index");
  if (!data && !pathname.startsWith("/applications/")) return null;
  const closed = data?.rows.filter((r) => CLOSED_TAB_STATUSES.has(r.status)).length ?? 0;
  return {
    onListPage: Boolean(data),
    selected: data ? selectedView(params) : null,
    tabs: [
      { key: "open", label: "Open", count: data ? data.rows.length - closed : null },
      { key: "saved", label: "Saved", count: data ? data.saved.length : null },
      { key: "closed", label: "Closed", count: data ? closed : null },
    ],
  };
}

export function ViewTabs({ className }: { className?: string }) {
  const views = useApplicationViews();
  if (!views) return null;
  return (
    <nav aria-label="Lists" className={cn("flex flex-wrap items-center gap-1 font-sans normal-case tracking-normal", className)}>
      {views.tabs.map((tab) => {
        const on = tab.key === views.selected;
        return (
          <Link
            key={tab.key}
            to={`/applications?view=${tab.key}`}
            replace
            preventScrollReset
            aria-current={on ? "page" : undefined}
            data-tour={tab.key}
            className={cn(
              "flex h-8 items-center gap-2 px-3 text-[13px] font-medium transition-colors",
              on ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
            )}
          >
            {tab.label}
            <span className="tabular-nums text-text-tertiary">{tab.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
