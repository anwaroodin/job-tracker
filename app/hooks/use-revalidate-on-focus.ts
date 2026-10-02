import { useEffect, useRef } from "react";
import { useRevalidator } from "react-router";

/**
 * Reloads the page's data when the tab comes back into view, so jobs saved or
 * bookmarked from the extension in another tab show without a manual refresh.
 */
export function useRevalidateOnFocus() {
  const revalidator = useRevalidator();
  // useRevalidator() returns a new object each render; read the latest one
  // from a ref so the listener is added once rather than on every render.
  const latest = useRef(revalidator);
  latest.current = revalidator;

  useEffect(() => {
    const onVisible = () => {
      const { state, revalidate } = latest.current;
      if (document.visibilityState === "visible" && state === "idle") revalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
