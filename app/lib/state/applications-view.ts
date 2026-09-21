import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import type { SortingState, VisibilityState } from "@tanstack/react-table";

/**
 * Local UI state for the applications data table. Legend State gives us
 * fine-grained reactive reads, and `persistObservable` writes to
 * localStorage so filters/sorts survive route navigation and reloads.
 * SSR-safe — persistence is only wired up when window exists.
 */
export interface ApplicationsView {
  search: string;
  status: string; // "all" | applied | interview | offer | rejected | ...
  sorting: SortingState;
  columnVisibility: VisibilityState;
  showHidden: boolean; // toggle for the ghosted/rejected bucket
}

export const applicationsView$ = observable<ApplicationsView>({
  search: "",
  status: "all",
  sorting: [{ id: "appliedAt", desc: true }],
  columnVisibility: {},
  showHidden: false,
});

if (typeof window !== "undefined") {
  persistObservable(applicationsView$, {
    local: "job-tracker/applications-view/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
