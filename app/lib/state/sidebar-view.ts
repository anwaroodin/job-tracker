import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";

/** Desktop sidebar collapse (icon rail vs full width). Persisted, SSR-safe. */
export const sidebarView$ = observable({ collapsed: false });

if (typeof window !== "undefined") {
  persistObservable(sidebarView$, {
    local: "job-tracker/sidebar-view/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
