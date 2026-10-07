import { Check, ChevronDown } from "lucide-react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { StatusBadge } from "~/components/ui/status-badge";
import { APPLICATION_STATUSES } from "~/lib/status";

const CHOICES = APPLICATION_STATUSES.filter((s) => s !== "saved");

export function StatusPicker({ status }: { status: string }) {
  const fetcher = useFetcher();
  const shown = (fetcher.formData?.get("status") as string | null) ?? status;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="tiny" className="-ml-3 gap-1 px-3 uppercase" disabled={fetcher.state !== "idle"} aria-label="Change status">
          <StatusBadge status={shown} />
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        {CHOICES.map((choice) => (
          <DropdownMenuItem key={choice} onSelect={() => choice !== shown && fetcher.submit({ intent: "status", status: choice }, { method: "post" })}>
            <StatusBadge status={choice} />
            {choice === shown && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
