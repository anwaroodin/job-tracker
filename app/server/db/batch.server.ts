import type { BatchItem } from "drizzle-orm/batch";

export const MAX_IDS_PER_STATEMENT = 90;

export function asBatch<T extends BatchItem<"sqlite">>(items: T[]) {
  return items as [T, ...T[]];
}
