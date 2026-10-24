import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";

export const tailoringTray$ = observable({ minimised: false });

if (typeof window !== "undefined") {
  persistObservable(tailoringTray$, {
    local: "job-tracker/tailoring-tray/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
