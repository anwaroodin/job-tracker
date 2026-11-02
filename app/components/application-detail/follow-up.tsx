import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

export function FollowUp({ quietDays, composeUrl }: { quietDays: number; composeUrl: string }) {
  const fetcher = useFetcher();
  if (fetcher.state !== "idle" || fetcher.data) return null;
  return (
    <div id="follow-up" className="flex scroll-mt-20 flex-wrap items-center justify-between gap-4 border border-dashed border-accent-tertiary bg-accent-quaternary/20 px-3.5 py-3">
      <p className="flex flex-col gap-1">
        <span className="text-[11px] text-accent-primary">No reply in {quietDays} days</span>
        <span className="font-sans text-[13px] normal-case tracking-normal text-text-secondary">
          A short follow-up often gets a stalled application looked at. Here’s a draft to edit and send.
        </span>
      </p>
      <span className="flex items-center gap-2">
        <Button asChild size="small" className="uppercase">
          <a href={composeUrl} target="_blank" rel="noopener noreferrer">
            Draft in Gmail ↗
          </a>
        </Button>
        <fetcher.Form method="post">
          <Button type="submit" name="intent" value="followed-up" variant="ghost" size="small" className="uppercase">
            Done
          </Button>
        </fetcher.Form>
      </span>
    </div>
  );
}
