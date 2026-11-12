import { Link } from "react-router";
import type { UpNext } from "~/types/up-next";
import { eventLabel, formatEventAt } from "~/lib/email";
import { fmtAgo } from "~/lib/format/time";
import { useArrivals } from "~/hooks/use-arrivals";
import { motion } from "motion/react";
import { CompanyLogo } from "~/components/applications/company-logo";
import { ListSection } from "~/components/applications/list-section";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { cn } from "~/lib/cn";

export function UpNextSection({ next }: { next: UpNext }) {
  const total = next.replies.length + next.upcoming.length + next.followUps.length;
  const isArrival = useArrivals([
    ...next.replies.map((r) => `reply-${r.emailId}`),
    ...next.upcoming.map((r) => `event-${r.emailId}`),
    ...next.followUps.map((r) => `follow-up-${r.applicationId}`),
  ]);
  return (
    <ListSection title="Up next" count={total}>
      <ul className={cn("flex flex-col", INSET_SEPARATORS)}>
        {next.replies.map((r) => (
          <UpNextRow
            key={`reply-${r.emailId}`}
            arrived={isArrival(`reply-${r.emailId}`)}
            to={`/applications/${r.applicationId}`}
            when="Reply needed"
            company={r.company}
            detail={r.subject}
            note={fmtAgo(r.receivedAt)}
          />
        ))}
        {next.upcoming.map((r) => (
          <UpNextRow
            key={`event-${r.emailId}`}
            arrived={isArrival(`event-${r.emailId}`)}
            to={`/applications/${r.applicationId}`}
            when={formatEventAt(r.eventAt!)}
            company={r.company}
            detail={r.role}
            note={eventLabel(r.category)}
          />
        ))}
        {next.followUps.map((r) => (
          <UpNextRow
            key={`follow-up-${r.applicationId}`}
            arrived={isArrival(`follow-up-${r.applicationId}`)}
            to={`/applications/${r.applicationId}#follow-up`}
            when={`No reply in ${r.quietDays}d`}
            company={r.company}
            detail={r.role}
            note="Follow up"
          />
        ))}
      </ul>
    </ListSection>
  );
}

function UpNextRow({
  to,
  when,
  company,
  detail,
  note,
  arrived,
}: {
  arrived: boolean;
  to: string;
  when: string;
  company: string;
  detail: string;
  note: string;
}) {
  return (
    <motion.li
      layout="position"
      initial={arrived ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(arrived && "arrive")}
    >
      <Link to={to} className="relative flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.04]">
        <CompanyLogo company={company} className="size-9 text-[14px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-text-primary">{company}</p>
          <p className="truncate text-[12.5px] text-text-tertiary">{detail}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-medium text-accent-primary">{when}</p>
          <p className="text-[12.5px] text-text-tertiary">{note}</p>
        </div>
      </Link>
    </motion.li>
  );
}
