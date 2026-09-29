import { observable } from "@legendapp/state";

export type SearchScope = "all" | "jobs" | "emails" | "nav";

export const commandPalette$ = observable<{
  open: boolean;
  scope: SearchScope;
}>({
  open: false,
  scope: "all",
});
