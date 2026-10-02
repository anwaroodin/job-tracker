import { Link } from "react-router";
import type { UpNext } from "~/types/up-next";
import { eventLabel, formatEventAt } from "~/lib/email";
import { fmtAgo } from "~/lib/format/time";
import { useArrivals } from "~/hooks/use-arrivals";
import { motion } from "motion/react";
import { Section } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";

export function UpNextSection({ n, next }: { n: string; next: UpNext }) {
  const total = next.replies.length + next.upcoming.length;
  const isArrival = useArrivals([
    ...next.replies.map((r) => `reply-${r.emailId}`),
    ...next.upcoming.map((r) => `event-${r.emailId}`),
  ]);
  return (
    <Section n={n} title="Up next" hint={`${total} ${total === 1 ? "thing" : "things"}`} i={1}>
      <ul className="-mx-3 divide-y divide-dashed divide-stroke-primary/50">
        {next.replies.map((r) => (
          <UpNextRow
            key={`reply-${r.emailId}`}
            arrived={isArrival(`reply-${r.emailId}`)}
            to={`/applications/${r.applicationId}`}
            when={<span className="text-text-primary group-hover:!text-text-inverse">Reply needed</span>}
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
      </ul>
    </Section>
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
  when: React.ReactNode;
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
      <Link
        to={to}
        className="group grid grid-cols-[124px_1fr] items-baseline gap-4 px-3 py-2 transition-colors hover:bg-text-primary hover:text-text-inverse sm:grid-cols-[150px_1fr_auto]"
      >
        <span className="text-text-tertiary group-hover:!text-text-inverse/60">{when}</span>
        <span className="min-w-0 truncate">
          <span className="text-text-primary group-hover:!text-text-inverse">{company}</span>
          <span className="text-text-tertiary group-hover:!text-text-inverse/60"> / {detail}</span>
        </span>
        <span className="hidden text-text-tertiary group-hover:!text-text-inverse/60 sm:block">{note}</span>
      </Link>
    </motion.li>
  );
}
