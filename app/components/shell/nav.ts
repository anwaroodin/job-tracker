import {
  Analytics01Icon,
  Briefcase01Icon,
  BubbleChatIcon,
  DashboardSquare01Icon,
  File01Icon,
  Settings01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

export const NAV: ReadonlyArray<{ to: string; label: string; short: string }> = [
  { to: "/overview", label: "Overview", short: "Overview" },
  { to: "/applications", label: "Applications", short: "Apps" },
  { to: "/cv", label: "CV", short: "CV" },
  { to: "/interviews", label: "Interviews", short: "Prep" },
  { to: "/profile", label: "Profile", short: "Profile" },
  { to: "/usage", label: "Usage", short: "Usage" },
  { to: "/settings", label: "Settings", short: "Settings" },
];

export const NAV_ICONS: Record<string, IconSvgElement> = {
  "/overview": DashboardSquare01Icon,
  "/applications": Briefcase01Icon,
  "/interviews": BubbleChatIcon,
  "/cv": File01Icon,
  "/profile": UserCircleIcon,
  "/usage": Analytics01Icon,
  "/settings": Settings01Icon,
};
