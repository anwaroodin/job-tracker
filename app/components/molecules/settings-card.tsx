import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export function SettingsCard({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-8 rounded-12 bg-bg-grouped-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-stroke-secondary px-6 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-text-primary">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-[12px] text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}
