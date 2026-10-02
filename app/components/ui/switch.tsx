import { cn } from "~/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative box-content inline-block h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors duration-150 ease-out",
          checked ? "bg-text-primary" : "bg-fill-primary",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-1/2 block size-4 -translate-y-1/2 rounded-full transition-all duration-150 ease-out",
            checked ? "translate-x-4 bg-bg-primary" : "bg-text-secondary",
          )}
        />
      </button>
      {label && <span className="text-[13px] text-text-primary">{label}</span>}
    </label>
  );
}
