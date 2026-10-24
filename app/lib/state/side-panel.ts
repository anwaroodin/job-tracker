import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";

/** Desktop right panel (job description) collapse. Persisted, SSR-safe. */
export const sidePanel$ = observable({ collapsed: false });

if (typeof window !== "undefined") {
  persistObservable(sidePanel$, {
    local: "job-tracker/side-panel/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
