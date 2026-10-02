import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "~/lib/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono font-medium uppercase tracking-[0.06em]",
    "transition-[background,color,box-shadow] duration-150 ease-out select-none cursor-pointer",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:size-3.5 [&_svg]:shrink-0",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-text-primary text-text-inverse hover:bg-white",
        secondary:
          "border border-stroke-primary bg-fill-secondary text-text-secondary hover:bg-fill-primary hover:text-text-primary",
        ghost:
          "bg-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary",
        destructive:
          "border border-red-tertiary bg-red-quaternary text-red-primary hover:bg-red-tertiary",
        link: "text-accent-primary hover:text-accent-secondary",
      },
      size: {
        tiny: "h-7 px-3 text-[10.5px]",
        small: "h-8 px-3.5 text-[11px]",
        medium: "h-9 px-4 text-[11.5px]",
        large: "h-11 px-6 text-[12.5px]",
        icon: "size-8",
        "icon-sm": "size-7",
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
