import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Input } from "~/components/atoms/input";
import { Label } from "~/components/atoms/label";
import { cn } from "~/lib/cn";

export interface FormFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
}

export function FormField({
  label,
  hint,
  error,
  trailing,
  className,
  ...inputProps
}: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          aria-describedby={hint || error ? hintId : undefined}
          {...inputProps}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-2 flex items-center text-text-tertiary">
            {trailing}
          </div>
        )}
      </div>
      {(hint || error) && (
        <p
          id={hintId}
          className={cn(
            "text-xs",
            error ? "text-red-primary" : "text-text-secondary",
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
