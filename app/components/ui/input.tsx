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
        "flex h-10 w-full border border-stroke-secondary bg-bg-primary px-3.5 text-[13px]",
        "text-text-primary placeholder:text-text-tertiary transition-colors",
        "hover:border-stroke-primary",
        "focus-visible:border-white/30 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
});
