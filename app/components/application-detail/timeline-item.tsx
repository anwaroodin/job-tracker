import { StatusBadge } from "~/components/ui/status-badge";
import { ChevronRight, Reply } from "lucide-react";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { NewBadge } from "~/components/ui/new-badge";
import { statusColor, fmtDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";

const QUIET = new Set(["other", "pending", "deleted"]);

export function TimelineItem({
  date,
  category,
  title,
  from,
  snippet,
  meta,
  href,
  unread,
  arrived,
  unsure,
  edited,
  confirmed,
  needsReply,
  defaultOpen,
  actions,
  footer,
}: {
  date?: string;
  category: string;
  title: string;
  from?: string;
  snippet?: string;
  meta?: string;
  href?: string;
  unread?: boolean;
  arrived?: boolean;
  unsure?: boolean;
  edited?: boolean;
  confirmed?: boolean;
  needsReply?: boolean;
  defaultOpen?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const color = statusColor(category);
  const quiet = QUIET.has(category) || unsure;
  const expandable = !!snippet;

  const headline = (
    <>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px]">
        <span className="text-text-tertiary sm:hidden">{date ? fmtDate(date) : "—"}</span>
        <StatusBadge status={category} variant="dot" className="text-[12.5px]" />
        {unread && <NewBadge className="self-center" />}
        {needsReply && (
          <span className="flex items-center gap-1 text-text-primary">
            <Reply className="size-3" />
            Reply needed
          </span>
        )}
        {unsure && (
          <span className="text-accent-primary" title="The classifier wasn't sure, so this email didn't change the status">
            Unsure
          </span>
        )}
        {edited && <span className="text-text-tertiary">Edited</span>}
        {confirmed && <span className="text-text-tertiary">Confirmed</span>}
      </span>
      <span className="mt-1 flex min-w-0 items-baseline gap-2 font-sans">
        <span className={cn("min-w-0 truncate text-[14px]", quiet ? "text-text-secondary" : "text-text-primary")}>{title}</span>
        {from && <span className="hidden min-w-0 shrink truncate text-[12px] text-text-tertiary sm:inline">{from}</span>}
      </span>
    </>
  );

  const link = href && meta && (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block text-[12.5px] text-text-tertiary underline-offset-4 transition-colors hover:text-text-primary hover:underline focus-visible:text-text-primary focus-visible:underline focus-visible:outline-none"
    >
      {meta} ↗
    </a>
  );

  return (
    <motion.li
      layout="position"
      initial={arrived ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-[14px_1fr] gap-x-4 sm:grid-cols-[96px_14px_1fr]"
    >
      <span className="hidden pt-[13px] text-[12.5px] text-text-tertiary tabular-nums sm:block">
        {date ? fmtDate(date) : "—"}
      </span>
      <span aria-hidden className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px bg-ink/10" />
        <span className="relative mt-[15px] size-[9px]" style={{ background: quiet ? "var(--fill-primary)" : color }} />
      </span>
      <div
        className={cn(
          "-ml-3 my-0.5 flex min-w-0 items-start gap-1 border border-transparent px-3 transition-colors",
          arrived && "arrive",
          unread && "bg-green-quaternary shadow-[inset_2px_0_0_var(--color-green-primary)]",
          open && !unread && "border-stroke-secondary bg-bg-grouped-primary",
          expandable && !open && !unread && "hover:bg-ink/[0.03]",
        )}
      >
        <div className="min-w-0 flex-1">
          {expandable ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="group flex w-full items-start gap-2 py-2.5 text-left focus-visible:outline-none"
            >
              <span className="flex min-w-0 flex-1 flex-col">{headline}</span>
              <ChevronRight
                aria-hidden
                className={cn(
                  "mt-[22px] size-3.5 shrink-0 text-text-tertiary transition-transform group-hover:text-text-primary group-focus-visible:text-text-primary",
                  open && "rotate-90",
                )}
              />
            </button>
          ) : (
            <div className="flex flex-col py-2.5">
              {headline}
              {link && <span className="mt-1.5">{link}</span>}
            </div>
          )}
          {expandable && open && (
            <div className="-mt-1 flex flex-col gap-2 pb-3">
              <p className="max-w-prose font-sans text-[12.5px] leading-relaxed text-text-secondary [overflow-wrap:anywhere]">
                {snippet}
              </p>
              {link}
            </div>
          )}
          {footer}
        </div>
        {actions}
      </div>
    </motion.li>
  );
}
