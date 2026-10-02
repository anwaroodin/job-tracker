import { Bookmark } from "lucide-react";
import { useFetcher } from "react-router";
import { cn } from "~/lib/cn";

/**
 * An application's `starred` flag reads as a bookmark on a saved posting
 * (not applied to yet) and as a star on everything else.
 */
const isBookmark = (status: string) => status === "saved";

function Glyph({ status, on }: { status: string; on: boolean }) {
  if (isBookmark(status)) return <Bookmark aria-hidden className={cn("inline size-3 -translate-y-px", on && "fill-current")} />;
  return <span aria-hidden>{on ? "★" : "☆"}</span>;
}

/** The inline mark shown before a flagged application's company in lists. */
export function FlagMark({ status, className }: { status: string; className?: string }) {
  const label = isBookmark(status) ? "Bookmarked" : "Starred";
  return (
    <span role="img" aria-label={label} title={label} className={cn("shrink-0 text-accent-primary", className)}>
      <Glyph status={status} on />
    </span>
  );
}

/**
 * Flags or unflags an application from its page, as an inline `★ Starred` /
 * `Bookmarked` toggle next to the status badge. Posts to the application's
 * route, so it works from any page, and shows the new state straight away.
 *
 * A plain <button> rather than the Button atom: this is meant to read as text
 * in the status line, and Button always draws a button box.
 */
export function FlagToggle({ id, status, flagged }: { id: string; status: string; flagged: boolean }) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("intent") === "flag" ? fetcher.formData.get("flagged") === "true" : null;
  const on = pending ?? flagged;
  const [off, onLabel] = isBookmark(status) ? ["Bookmark", "Bookmarked"] : ["Star", "Starred"];

  return (
    <button
      type="button"
      // A toggle keeps one accessible name; aria-pressed carries the state.
      aria-label={off}
      aria-pressed={on}
      onClick={() => fetcher.submit({ intent: "flag", flagged: String(!on) }, { method: "post", action: `/applications/${id}` })}
      className={cn(
        "inline-flex items-center gap-1.5 uppercase transition-colors focus-visible:outline-none focus-visible:underline",
        on ? "text-accent-primary hover:text-accent-secondary" : "text-text-tertiary hover:text-text-primary",
      )}
    >
      <Glyph status={status} on={on} />
      {on ? onLabel : off}
    </button>
  );
}
