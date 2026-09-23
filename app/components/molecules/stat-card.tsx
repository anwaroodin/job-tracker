import type { ReactNode } from "react";
import { Card, CardContent } from "~/components/atoms/card";
import { cn } from "~/lib/cn";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("flex-1", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5 pt-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {label}
          </span>
          <span className="text-2xl font-semibold text-text-primary">
            {value}
          </span>
          {hint && <span className="text-xs text-text-secondary">{hint}</span>}
        </div>
        {icon && (
          <span className="flex size-10 items-center justify-center bg-fill-tertiary text-text-secondary">
            {icon}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
