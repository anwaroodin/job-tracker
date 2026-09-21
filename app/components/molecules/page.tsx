import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
      {children}
    </p>
  );
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="pb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-8">
        <div>
          <h1 className="text-[52px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[13px] text-text-secondary">{subtitle}</p>
          )}
        </div>
        {aside && <div className="flex items-stretch gap-8">{aside}</div>}
      </div>
    </section>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-stroke-secondary", className)} />;
}

export function SectionLabel({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-text-primary">
        {title}
      </h2>
      {sub && <span className="text-[12px] text-text-tertiary">{sub}</span>}
    </div>
  );
}

export function Section({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-10", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <SectionLabel title={title} sub={sub} />
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function InlineStat({
  label,
  value,
  trend,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  trend?: { value: string; tone: "up" | "down" };
  tone?: "up" | "down" | "neutral";
  className?: string;
}) {
  const toneColor =
    tone === "up"
      ? "text-green-primary"
      : tone === "down"
        ? "text-red-primary"
        : "text-text-primary";
  return (
    <div
      className={cn(
        "flex flex-col border-l border-stroke-secondary pl-6 first:border-0 first:pl-0",
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            "text-[22px] font-semibold leading-none tabular-nums",
            toneColor,
          )}
        >
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              trend.tone === "up" ? "text-green-primary" : "text-red-primary",
            )}
          >
            {trend.value}
          </span>
        )}
      </p>
    </div>
  );
}
