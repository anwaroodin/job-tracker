import { Section, STATUS_COLORS } from "~/components/ui/terminal";
import { StatusBadge } from "~/components/ui/status-badge";
import { cn } from "~/lib/cn";

const STAGES = ["applied", "screening", "assessment", "interview", "offer"] as const;
const OUTCOMES = new Set(["rejected", "accepted", "withdrawn", "ghosted"]);

export function Progress({ status, reached }: { status: string; reached: Set<string> }) {
  return (
    <Section n="02" title="Progress" i={1}>
      <ol className="grid grid-cols-5 gap-1">
        {STAGES.map((stage) => {
          const on = reached.has(stage);
          return (
            <li key={stage} className="flex min-w-0 flex-col gap-2">
              <span
                aria-hidden
                className="h-[3px] w-full"
                style={{ background: on ? STATUS_COLORS[stage] : "rgba(255,255,255,0.08)" }}
              />
              <span
                className={cn(
                  "truncate text-[10px] tracking-[0.08em] sm:text-[11px]",
                  stage === status ? "text-text-primary" : on ? "text-text-secondary" : "text-text-tertiary",
                )}
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ol>
      {OUTCOMES.has(status) && (
        <p className="mt-4 text-[11px] tracking-[0.08em] text-text-tertiary">
          Outcome <StatusBadge status={status} className="ml-2" />
        </p>
      )}
    </Section>
  );
}
