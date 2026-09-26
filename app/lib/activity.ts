import { eventLabel, formatEventAt } from "./email";

export type ActivityKind = "email" | "status" | "reply" | "event" | "suggestion";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  createdAt: string;
  seen: boolean;
  applicationId: string | null;
  company: string | null;
  subject: string | null;
  detail: Record<string, string | null>;
}

export function describeActivity(item: ActivityItem) {
  const company = item.company ?? item.detail.company ?? "An application";
  const href = item.applicationId ? `/applications/${item.applicationId}` : "/applications";
  switch (item.kind) {
    case "status":
      return { tag: item.detail.to ?? "status", title: `${company} moved to ${item.detail.to}`, body: null, href };
    case "reply":
      return { tag: "reply", title: `${company} is waiting on your reply`, body: item.subject, href };
    case "event": {
      const label = eventLabel(item.detail.category ?? "");
      const when = item.detail.eventAt ? formatEventAt(item.detail.eventAt) : "";
      return { tag: item.detail.category ?? "event", title: `${label} ${when} · ${company}`, body: item.subject, href };
    }
    case "suggestion": {
      const role = item.detail.role ? ` / ${item.detail.role}` : "";
      return { tag: "suggested", title: `Untracked application: ${company}${role}`, body: item.subject, href };
    }
    default:
      return { tag: item.detail.category ?? "email", title: `New email from ${company}`, body: item.subject, href };
  }
}

export const ACTIVITY_TABS = [
  { id: "all", label: "All", empty: "Nothing yet. Matched emails, status changes, replies and suggestions from Gmail syncs show up here." },
  { id: "updates", label: "Updates", empty: "No new emails or status changes yet." },
  { id: "todo", label: "To do", empty: "Nothing waiting on you. Replies needed, interviews and deadlines show up here." },
  { id: "suggestions", label: "Suggestions", empty: "No untracked applications found in your inbox." },
  { id: "rejections", label: "Rejections", empty: "No rejections. Keep going." },
] as const;

export type ActivityTab = (typeof ACTIVITY_TABS)[number]["id"];

export function activityTab(item: ActivityItem): Exclude<ActivityTab, "all"> {
  if (item.kind === "suggestion") return "suggestions";
  if (item.kind === "reply" || item.kind === "event") return "todo";
  const rejected = item.kind === "status" ? item.detail.to === "rejected" : item.detail.category === "rejected";
  return rejected ? "rejections" : "updates";
}
