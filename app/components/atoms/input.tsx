import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-8 bg-bg-primary px-3 py-2 text-[13px]",
        "text-text-primary placeholder:text-text-tertiary",
        "[box-shadow:inset_0_0_0_1px_var(--stroke-primary)]",
        "focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--text-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
