import { usePersisted } from "~/hooks/use-persisted";
import { onboarding$ } from "~/lib/state/onboarding";
import { LESSON_IDS } from "./lessons";

export function useLessons(gmailConnected: boolean) {
  const done = usePersisted(() => onboarding$.done.get(), []);
  const hidden = usePersisted(() => onboarding$.hidden.get(), true);
  const finished = (id: string) => done.includes(id) || (id === "gmail" && gmailConnected);
  const count = LESSON_IDS.filter(finished).length;
  return { finished, count, total: LESSON_IDS.length, show: !hidden && count < LESSON_IDS.length };
}
