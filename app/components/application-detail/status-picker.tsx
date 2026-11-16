import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { StatusBadge } from "~/components/ui/status-badge";
import { statusWord } from "~/components/shell/brand-word";
import { APPLICATION_STATUSES } from "~/lib/status";
import { celebrate } from "~/lib/state/milestone";

const CHOICES = APPLICATION_STATUSES.filter((s) => s !== "saved");

export function StatusPicker({ id, status, company, role }: { id: string; status: string; company: string; role: string }) {
  const fetcher = useFetcher();
  const shown = (fetcher.formData?.get("status") as string | null) ?? status;
  const choose = (choice: string) => {
    fetcher.submit({ intent: "status", status: choice }, { method: "post" });
    if (statusWord(choice)) celebrate({ applicationId: id, company, role, status: choice });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="h-9 gap-2 px-3 text-[13.5px]"
          disabled={fetcher.state !== "idle"}
          aria-label="Change status"
        >
          <StatusBadge status={shown} variant="dot" />
          <HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Set status</DropdownMenuLabel>
        {CHOICES.map((choice) => (
          <DropdownMenuItem key={choice} onSelect={() => choice !== shown && choose(choice)}>
            <StatusBadge status={choice} variant="dot" />
            {choice === shown && <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={1.5} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
