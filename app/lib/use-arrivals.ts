import { useRef } from "react";

export function useArrivals(ids: string[], scope = "") {
  const baseline = useRef<{ scope: string; ids: Set<string> } | null>(null);
  if (baseline.current?.scope !== scope) baseline.current = { scope, ids: new Set(ids) };
  const known = baseline.current.ids;
  return (id: string) => !known.has(id);
}
