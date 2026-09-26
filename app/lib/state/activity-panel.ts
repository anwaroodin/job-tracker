import { observable } from "@legendapp/state";
import { persistObservable } from "@legendapp/state/persist";
import { ObservablePersistLocalStorage } from "@legendapp/state/persist-plugins/local-storage";
import type { ActivityTab } from "~/lib/activity";

export const activityPanel$ = observable({ open: false });

export const activityTab$ = observable<{ tab: ActivityTab }>({ tab: "all" });

if (typeof window !== "undefined") {
  persistObservable(activityTab$, {
    local: "job-tracker/activity-tab/v1",
    pluginLocal: ObservablePersistLocalStorage,
  });
}
