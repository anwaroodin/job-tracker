import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-12 bg-bg-grouped-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]",
        className,
      )}
    >
      <div className="border-b border-stroke-secondary px-6 py-4">
        <h2 className="text-[14px] font-semibold text-text-primary">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[12px] text-text-secondary">
            {description}
          </p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
