/**
 * Deduplicates applications by (company, role), keeping only the record
 * with the most recent status / activity (by updatedAt or appliedAt).
 */
export function deduplicateApplications<
  T extends {
    company: string;
    role: string;
    appliedAt: string;
    updatedAt?: string | null;
  },
>(items: T[]): T[] {
  const recency = (item: T) =>
    Math.max(item.updatedAt ? Date.parse(item.updatedAt) || 0 : 0, Date.parse(item.appliedAt) || 0);
  const newestFirst = items.map((item) => ({ item, at: recency(item) })).sort((a, b) => b.at - a.at);

  const seen = new Set<string>();
  const result: T[] = [];
  for (const { item } of newestFirst) {
    const key = `${item.company.trim().toLowerCase()}:::${item.role.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
