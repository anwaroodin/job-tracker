import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
    "transition-[background,color,box-shadow] duration-150 ease-out select-none",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-text-primary text-bg-primary hover:opacity-90 active:opacity-80 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.08)]",
        secondary:
          "bg-bg-primary text-text-primary hover:bg-bg-grouped-tertiary [box-shadow:inset_0_0_0_1px_var(--stroke-primary)]",
        ghost: "bg-transparent text-text-primary hover:bg-fill-tertiary",
        destructive:
          "bg-red-primary text-text-inverse hover:opacity-90 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.08)]",
        link: "text-text-primary underline-offset-4 hover:underline",
      },
      size: {
        tiny: "h-7 rounded-8 px-2.5 text-[12px]",
        small: "h-8 rounded-8 px-3 text-[13px]",
        medium: "h-9 rounded-8 px-3.5 text-[13px]",
        large: "h-10 rounded-8 px-4 text-[14px]",
        icon: "size-8 rounded-8",
        "icon-sm": "size-7 rounded-6",
      },
    },
    defaultVariants: { variant: "primary", size: "medium" },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, asChild = false, ...props },
    ref,
  ) {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

export { buttonVariants };
