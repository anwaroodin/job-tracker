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
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-0.5 font-sans normal-case tracking-normal", disabled && "opacity-40")}>
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
              "flex h-8 cursor-pointer select-none items-center px-3 text-[13px] font-medium transition-colors disabled:cursor-default",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-text-secondary",
              selected ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
