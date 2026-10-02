import { useRef } from "react";
import type { TimelineEmail } from "~/types/timeline";

export function useNewOnArrival(applicationId: string, emails: TimelineEmail[]) {
  const arrivals = useRef<{ applicationId: string; ids: Set<string> } | null>(null);
  if (arrivals.current?.applicationId !== applicationId) arrivals.current = { applicationId, ids: new Set() };
  const arrived = arrivals.current.ids;
  for (const email of emails) if (!email.viewedAt) arrived.add(email.id);
  return (email: TimelineEmail) => arrived.has(email.id) || !email.viewedAt;
}
