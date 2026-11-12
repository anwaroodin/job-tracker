import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

export function FollowUp({ quietDays, composeUrl }: { quietDays: number; composeUrl: string }) {
  const fetcher = useFetcher();
  if (fetcher.state !== "idle" || fetcher.data) return null;
  return (
    <div id="follow-up" className="flex scroll-mt-20 flex-wrap items-center justify-between gap-4 border border-accent-tertiary bg-accent-quaternary px-4 py-3.5 shadow-[inset_3px_0_0_var(--color-accent-primary)]">
      <p className="flex flex-col gap-1">
        <span className="text-[12.5px] font-semibold text-accent-primary">No reply in {quietDays} days</span>
        <span className="font-sans text-[13px] text-text-primary">
          A short follow-up often gets a stalled application looked at. Here’s a draft to edit and send.
        </span>
      </p>
      <span className="flex items-center gap-2">
        <Button asChild size="small" className="">
          <a href={composeUrl} target="_blank" rel="noopener noreferrer">
            Draft in Gmail ↗
          </a>
        </Button>
        <fetcher.Form method="post">
          <Button type="submit" name="intent" value="followed-up" variant="ghost" size="small" className="">
            Done
          </Button>
        </fetcher.Form>
      </span>
    </div>
  );
}
