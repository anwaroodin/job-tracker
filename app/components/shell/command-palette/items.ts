import type { SearchApplicationItem, SearchEmailItem } from "~/types/search";

export const NAV_ITEMS = [
  { id: "nav-overview", label: "Overview", to: "/overview", hint: "Dashboard summary & readout" },
  { id: "nav-applications", label: "Applications", to: "/applications", hint: "All saved & logged applications" },
  { id: "nav-profile", label: "Profile", to: "/profile", hint: "Personal info, CVs & integrations" },
  { id: "nav-usage", label: "Usage", to: "/usage", hint: "Spend & classification metrics" },
  { id: "nav-settings", label: "Settings", to: "/settings", hint: "Preferences & sync settings" },
];

export type SelectableItem =
  | { type: "nav"; item: (typeof NAV_ITEMS)[number] }
  | { type: "app"; item: SearchApplicationItem }
  | { type: "email"; item: SearchEmailItem };
