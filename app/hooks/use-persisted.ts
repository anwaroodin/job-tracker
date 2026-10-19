import { useSelector } from "@legendapp/state/react";
import { useEffect, useState } from "react";

export function usePersisted<T>(selector: () => T, serverValue: T) {
  const value = useSelector(selector);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated ? value : serverValue;
}
