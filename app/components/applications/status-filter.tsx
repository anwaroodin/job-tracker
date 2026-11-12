import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { StatusBadge } from "~/components/ui/status-badge";

function Tick({ on }: { on: boolean }) {
  return <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={1.5} className={on ? undefined : "invisible"} />;
}

export function StatusFilter({
  options,
  value,
  onChange,
}: {
  options: { status: string; count: number }[];
  value: string | null;
  onChange: (status: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="tiny"
          className="h-9 gap-2 border-stroke-secondary bg-bg-primary px-3 font-sans text-[13px] font-medium normal-case tracking-normal text-text-primary hover:border-stroke-primary hover:bg-bg-primary"
        >
          {value ? <StatusBadge status={value} variant="dot" /> : "All statuses"}
          <HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 font-sans text-[13px] normal-case tracking-normal">
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <Tick on={!value} />
          All statuses
        </DropdownMenuItem>
        {options.map(({ status, count }) => (
          <DropdownMenuItem key={status} onSelect={() => onChange(status)}>
            <Tick on={value === status} />
            <StatusBadge status={status} variant="dot" />
            <span className="ml-auto tabular-nums text-text-tertiary">{count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
