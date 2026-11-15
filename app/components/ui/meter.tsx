import { cn } from "~/lib/cn";

const clamp = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

export function Meter({ share, extra, className, extraClassName }: { share: number; extra?: number; className?: string; extraClassName?: string }) {
  return (
    <span aria-hidden className="flex h-1.5 w-full overflow-hidden bg-ink/[0.08]">
      <span className={cn("h-full bg-text-secondary", className)} style={{ width: clamp(share) }} />
      {extra ? <span className={cn("h-full bg-text-primary", extraClassName)} style={{ width: clamp(extra) }} /> : null}
    </span>
  );
}
