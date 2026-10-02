import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { formatDollars } from "~/lib/settings";
import type { SyncResult } from "~/types/gmail";
import { Setting } from "~/components/settings/setting-row";

export function ReclassifyAll({
  emails,
  cost,
  usesJev,
  connected,
}: {
  emails: number;
  cost: number;
  usesJev: boolean;
  connected: boolean;
}) {
  const fetcher = useFetcher<{ reclassify?: SyncResult }>();
  const running = fetcher.state !== "idle";
  const result = running ? undefined : fetcher.data?.reclassify;
  return (
    <Setting
      label="Reclassify all emails"
      description={
        connected
          ? `Runs the current classifier over ${emails} stored ${emails === 1 ? "email" : "emails"} and updates statuses. ` +
            (usesJev ? `Roughly ${formatDollars(cost)} with Jev. ` : "") +
            "Emails you've corrected by hand are left alone."
          : "Connect Gmail first. Reclassifying runs as part of a Gmail sync."
      }
    >
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={running || emails === 0 || !connected}
          onClick={() => fetcher.submit({ intent: "reclassify" }, { method: "post" })}
        >
          {running ? "Reclassifying…" : "Reclassify"}
        </Button>
        {result && (
          <span
            className={cn(
              "max-w-56 text-[10.5px] tracking-[0.08em] sm:text-right",
              result.error ? "text-red-primary" : result.busy ? "text-text-tertiary" : "text-green-primary",
            )}
          >
            {result.error ?? (result.busy ? "A sync just ran. It'll reclassify on the next one." : "Done")}
          </span>
        )}
      </div>
    </Setting>
  );
}
