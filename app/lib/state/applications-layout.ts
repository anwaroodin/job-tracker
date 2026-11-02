import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";

/** Applications list as a table or a board of status columns. Persisted, SSR-safe. */
export const applicationsLayout$ = observable({ board: false });

if (typeof window !== "undefined") {
  persistObservable(applicationsLayout$, {
    local: "job-tracker/applications-layout/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
