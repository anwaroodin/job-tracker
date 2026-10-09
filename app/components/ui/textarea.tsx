import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y border border-stroke-secondary bg-bg-primary px-3.5 py-2.5 text-[13px] normal-case tracking-normal",
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
