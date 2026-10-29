import { useRouteLoaderData } from "react-router";
import type { Route } from "./+types/classic";
import { useMemo, useState } from "react";
import { ApplicationsHeader } from "~/components/applications/applications-header";
import { Section } from "~/components/ui/terminal";
import { UnsureEmailsBanner } from "~/components/applications/unsure-emails-banner";
import { useArrivals } from "~/hooks/use-arrivals";
import { OffersBanner } from "~/components/applications/offers-banner";
import { SuggestionsBanner } from "~/components/applications/suggestions-banner";
import { SavedSection } from "~/components/applications/saved-section";
import { TableToolbar } from "~/components/applications/table-toolbar";
import { ApplicationsTable } from "~/components/applications/applications-table";
import { useApplicationsView } from "~/components/applications/use-applications-view";
import { ApplicationsBoard } from "~/components/applications/applications-board";
import { usePersisted } from "~/hooks/use-persisted";
import { LayoutToggle } from "~/components/applications/layout-toggle";
import { applicationsLayout$ } from "~/lib/state/applications-layout";
import type { loader as layoutLoader } from "../layout";

export { loader, action } from "./index";

export default function ApplicationsClassic({ loaderData }: Route.ComponentProps) {
  const { gmail, unread } = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!;
  const rows = useMemo(
    () => loaderData.rows.map((a) => ({ ...a, unread: unread[a.id] ?? 0 })),
    [loaderData.rows, unread],
  );
  const saved = loaderData.saved;
  const suggestions = loaderData.suggestions;
  const view = useApplicationsView(rows);
  const { total, activeCount, offersList, offersCount, closedCount, filteredItems } = view;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const board = usePersisted(() => applicationsLayout$.board.get(), false);

  const isArrival = useArrivals([
    ...rows.map((r) => r.id),
    ...saved.map((s) => s.id),
  ]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 font-mono text-[12.5px] uppercase tracking-[0.04em]">
      <ApplicationsHeader
        total={total}
        activeCount={activeCount}
        offersCount={offersCount}
        closedCount={closedCount}
        gmail={gmail}
      />

      {offersCount > 0 && <OffersBanner offersList={offersList} offersCount={offersCount} />}

      {suggestions.length > 0 && (
        <SuggestionsBanner
          suggestions={suggestions}
          accountEmail={loaderData.accountEmail}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
        />
      )}

      {loaderData.unsure.length > 0 && <UnsureEmailsBanner emails={loaderData.unsure} />}

      <SavedSection saved={saved} isArrival={isArrival} />

      <Section
        n="03"
        title="Tracked applications"
        hint={
          <span className="flex items-center gap-3">
            {filteredItems.length} matching
            <LayoutToggle board={board} />
          </span>
        }
        i={2}
      >
        <div className="flex flex-col gap-4">
          <TableToolbar view={view} />
          {board ? (
            <ApplicationsBoard items={filteredItems} tab={view.activeTab} />
          ) : (
            <ApplicationsTable view={view} gmail={gmail} isArrival={isArrival} />
          )}
        </div>
      </Section>
    </div>
  );
}
