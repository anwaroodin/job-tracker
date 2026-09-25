export const EMAIL_CATEGORIES = ["applied", "screening", "interview", "assessment", "offer", "rejected", "other"] as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export function isEmailCategory(value: unknown): value is EmailCategory {
  return EMAIL_CATEGORIES.includes(value as EmailCategory);
}

export const DETAIL_CATEGORIES: readonly EmailCategory[] = ["screening", "interview", "assessment", "offer"];

const MEETING_HOSTS = /(^|\.)(zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|whereby\.com|bluejeans\.com|chime\.aws)$/i;
const BOOKING_HOSTS = /(^|\.)(calendly\.com|cal\.com|goodtime\.io|youcanbook\.me|doodle\.com|savvycal\.com|acuityscheduling\.com)$/i;

export function actionLabel(url: string, category: string) {
  const host = hostOf(url);
  if (MEETING_HOSTS.test(host)) return "Join meeting";
  if (BOOKING_HOSTS.test(host)) return "Book a time";
  if (category === "assessment") return "Open assessment";
  if (category === "offer") return "View offer";
  return "Open link";
}

export function eventLabel(category: string) {
  if (category === "assessment") return "Due";
  if (category === "offer") return "Respond by";
  if (category === "screening") return "Call";
  return "Interview";
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatEventAt(eventAt: string) {
  const [date, time] = eventAt.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const weekday = DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${String(day).padStart(2, "0")} ${MONTHS[month - 1]}${time ? `, ${time}` : ""}`;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
