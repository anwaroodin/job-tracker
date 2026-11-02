import { Check, ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { StatusBadge } from "~/components/ui/status-badge";

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
        <Button type="button" variant="secondary" size="tiny" className="h-8">
          {value ? <StatusBadge status={value} /> : "All statuses"}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 font-mono text-[11px] uppercase tracking-[0.06em]">
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <Check className={value ? "invisible" : undefined} />
          All statuses
        </DropdownMenuItem>
        {options.map(({ status, count }) => (
          <DropdownMenuItem key={status} onSelect={() => onChange(status)}>
            <Check className={value === status ? undefined : "invisible"} />
            <StatusBadge status={status} />
            <span className="ml-auto tabular-nums text-text-tertiary">{count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
