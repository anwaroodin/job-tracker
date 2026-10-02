import { Reply } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode } from "react";
import { NewBadge } from "~/components/ui/new-badge";
import { STATUS_COLORS, fmtDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";

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
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const color = STATUS_COLORS[category] ?? "#6e6f76";
  const body = (
    <>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tracking-[0.08em]">
        <span className="text-text-tertiary sm:hidden">{date ? fmtDate(date) : "—"}</span>
        <span style={{ color }}>[{category}]</span>
        {unread && <NewBadge className="self-center" />}
        {needsReply && (
          <span className="flex items-center gap-1 text-text-primary">
            <Reply className="size-3" />
            Reply needed
          </span>
        )}
        {unsure && (
          <span
            className="text-accent-primary"
            title="The classifier wasn't sure, so this email didn't change the status"
          >
            Unsure
          </span>
        )}
        {edited && <span className="text-text-tertiary">Edited</span>}
        {confirmed && <span className="text-text-tertiary">Confirmed</span>}
      </p>
      <p className="mt-1.5 font-sans text-[14px] normal-case tracking-normal text-text-primary">{title}</p>
      {from && (
        <p className="mt-0.5 truncate font-sans text-[12px] normal-case tracking-normal text-text-tertiary">{from}</p>
      )}
      {snippet && (
        <p className="mt-2 line-clamp-2 font-sans text-[12.5px] normal-case leading-relaxed tracking-normal text-text-secondary">
          {snippet}
        </p>
      )}
      {meta && href && (
        <p className="mt-2 text-[10.5px] tracking-[0.1em] text-text-tertiary transition-colors group-hover:text-text-primary">
          {meta} ↗
        </p>
      )}
    </>
  );

  return (
    <motion.li
      layout="position"
      initial={arrived ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-[14px_1fr] gap-x-4 sm:grid-cols-[96px_14px_1fr]"
    >
      <span className="hidden pt-[13px] text-[11px] tracking-[0.08em] text-text-tertiary sm:block">
        {date ? fmtDate(date) : "—"}
      </span>
      <span aria-hidden className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px bg-white/10" />
        <span className="relative mt-[15px] size-[9px]" style={{ background: color }} />
      </span>
      <div
        className={cn(
          "-mx-3 my-1 flex min-w-0 items-start gap-1 px-3 transition-colors",
          arrived && "arrive",
          unread && "bg-green-quaternary shadow-[inset_2px_0_0_var(--color-green-primary)]",
          href && "hover:bg-white/[0.04] has-[a:focus-visible]:bg-white/[0.04] has-[[data-state=open]]:bg-white/[0.04]",
        )}
      >
        <div className="min-w-0 flex-1">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block py-2.5 focus-visible:outline-none"
            >
              {body}
            </a>
          ) : (
            <div className="py-2.5">{body}</div>
          )}
          {footer}
        </div>
        {actions}
      </div>
    </motion.li>
  );
}
