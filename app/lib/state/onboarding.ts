import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";

/** Finished lessons and whether the Getting started list is hidden. Persisted, SSR-safe. */
export const onboarding$ = observable({ done: [] as string[], hidden: false });

if (typeof window !== "undefined") {
  persistObservable(onboarding$, {
    local: "job-tracker/onboarding/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
