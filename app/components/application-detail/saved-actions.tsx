import { ArrowUpRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

export function SavedActions({ url }: { url: string }) {
  const fetcher = useFetcher();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url && (
        <Button asChild variant="secondary" size="small">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open posting
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={1.5} />
          </a>
        </Button>
      )}
      <Button
        type="button"
        size="small"
        disabled={fetcher.state !== "idle"}
        onClick={() => fetcher.submit({ intent: "saved-applied" }, { method: "post" })}
      >
        <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={1.5} />
        Mark applied
      </Button>
    </div>
  );
}

export function BackToSaved() {
  const fetcher = useFetcher();
  return (
    <Button
      type="button"
      variant="ghost"
      size="tiny"
      disabled={fetcher.state !== "idle"}
      title="Not applied yet: move it back to your saved jobs"
      onClick={() => fetcher.submit({ intent: "unapply" }, { method: "post" })}
    >
      Back to saved
    </Button>
  );
}
