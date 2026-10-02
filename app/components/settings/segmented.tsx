import { cn } from "~/lib/cn";

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex border border-stroke-primary", disabled && "opacity-40")}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 px-3.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors [&+&]:border-l [&+&]:border-stroke-primary",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-text-secondary",
              selected ? "bg-text-primary text-text-inverse" : "bg-fill-secondary text-text-secondary hover:bg-fill-primary hover:text-text-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
