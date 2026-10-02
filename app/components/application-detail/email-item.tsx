import { ArrowUpRight, CalendarClock, Check } from "lucide-react";
import { useFetcher } from "react-router";
import type { TimelineEmail } from "~/types/timeline";
import { Button } from "~/components/ui/button";
import { actionLabel, eventLabel, formatEventAt } from "~/lib/email";
import { TimelineItem } from "~/components/application-detail/timeline-item";
import { EmailActions } from "~/components/application-detail/email-actions";

export function EmailItem({
  email,
  href,
  isNew,
  arrived,
}: {
  email: TimelineEmail;
  href: string;
  isNew: boolean;
  arrived: boolean;
}) {
  if (email.category === "deleted") {
    return (
      <TimelineItem
        category="deleted"
        title="Deleted from Gmail"
        arrived={arrived}
        actions={<EmailActions email={email} unlinkOnly />}
      />
    );
  }
  if (!email.category) {
    return (
      <TimelineItem
        category="pending"
        title="Email details not synced yet"
        arrived={arrived}
        meta="Open in Gmail"
        href={href}
        actions={<EmailActions email={email} unlinkOnly />}
      />
    );
  }
  return (
    <TimelineItem
      date={email.receivedAt ?? undefined}
      category={email.category}
      title={email.subject || "(no subject)"}
      from={email.fromName || email.fromAddress || undefined}
      snippet={email.snippet || undefined}
      meta="Open in Gmail"
      href={href}
      unread={isNew}
      arrived={arrived}
      unsure={email.unsure}
      edited={email.edited}
      confirmed={email.confirmed}
      needsReply={email.needsReply}
      footer={<EmailDetails email={email} />}
      actions={<EmailActions email={email} />}
    />
  );
}

function EmailDetails({ email }: { email: TimelineEmail }) {
  const fetcher = useFetcher();
  const replied = fetcher.formData?.get("intent") === "replied";
  const needsReply = email.needsReply && !replied;
  if (!email.eventAt && !email.actionUrl && !needsReply) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 text-[11px] tracking-[0.08em]">
      {email.eventAt && (
        <span className="flex items-center gap-1.5 text-text-primary" title={email.eventText ?? undefined}>
          <CalendarClock className="size-3.5 text-text-tertiary" />
          <span className="text-text-tertiary">{eventLabel(email.category ?? "")}</span>
          {formatEventAt(email.eventAt)}
        </span>
      )}
      {email.actionUrl && (
        <Button asChild variant="secondary" size="tiny">
          <a href={email.actionUrl} target="_blank" rel="noopener noreferrer" title={email.actionText ?? email.actionUrl}>
            {actionLabel(email.actionUrl, email.category ?? "")}
            <ArrowUpRight />
          </a>
        </Button>
      )}
      {needsReply && (
        <Button
          type="button"
          variant="ghost"
          size="tiny"
          onClick={() => fetcher.submit({ intent: "replied", id: email.id }, { method: "post" })}
        >
          <Check />
          Mark replied
        </Button>
      )}
    </div>
  );
}
