import { ACTIVE_STATUSES } from "~/lib/status";

const DAY_MS = 86_400_000;
const FOLLOW_UP_AFTER_DAYS = 14;
const STOP_AFTER_DAYS = 60;
const AUTOMATED_SENDER = /no-?reply|do-?not-?reply|notifications?@|mailer-daemon|alerts?@/i;

export interface FollowUpApp {
  status: string;
  appliedAt: string;
  followedUpAt: string | null;
}

export function quietDays(app: FollowUpApp, lastEmailAt: string | null, now: Date) {
  if (!ACTIVE_STATUSES.has(app.status)) return null;
  const lastActivity = [app.appliedAt, app.followedUpAt, lastEmailAt].filter((d): d is string => !!d).sort().at(-1)!;
  const days = Math.floor((now.getTime() - Date.parse(lastActivity)) / DAY_MS);
  return days >= FOLLOW_UP_AFTER_DAYS && days <= STOP_AFTER_DAYS ? days : null;
}

export function followUpRecipient(emails: { fromAddress: string; receivedAt: string }[]) {
  const people = emails.filter((e) => e.fromAddress && !AUTOMATED_SENDER.test(e.fromAddress));
  return people.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]?.fromAddress ?? "";
}

export function followUpDraft(app: { company: string; role: string; appliedAt: string }, sender: string) {
  const date = new Date(app.appliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  return {
    subject: `Following up on my application for ${app.role}`,
    body: [
      "Hi,",
      "",
      `I applied for the ${app.role} role at ${app.company} on ${date} and wanted to follow up. I'm still very interested and happy to share anything else that would help.`,
      "",
      "Thanks for your time,",
      sender,
    ].join("\n"),
  };
}
