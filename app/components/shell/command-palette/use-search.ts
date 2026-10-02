import { useEffect, useState } from "react";
import type { SearchResults } from "~/types/search";

export function useSearch(open: boolean) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResults>({ applications: [], emails: [] });

  // Fetch search results with debouncing
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = (await res.json()) as SearchResults;
          setData(json);
        }
      } catch (err) {
        console.error("Search fetch failed", err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [open, query]);

  return { query, setQuery, loading, data };
}
