import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CompanyLogo } from "~/components/applications/company-logo";
import { StatusBadge } from "~/components/ui/status-badge";
import { describeActivity, type ActivityItem } from "~/lib/activity";
import { fmtAgo } from "~/lib/format/time";

export function ActivityRow({ item, fresh, now }: { item: ActivityItem; fresh: boolean; now: number }) {
  const { tag, title, body } = describeActivity(item);
  const company = item.company ?? item.detail.company;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 font-sans text-[14px] normal-case tracking-normal">
      {company ? (
        <CompanyLogo company={company} className="size-8 text-[13px]" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center bg-ink/[0.05] text-text-secondary">
          <HugeiconsIcon icon={Mail01Icon} size={17} strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{title}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-tertiary">
          <StatusBadge status={tag} variant="dot" className="shrink-0 text-[12.5px]" />
          {body && <span className="truncate">· {body}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start pt-0.5 text-[12.5px] text-text-tertiary">
        <span suppressHydrationWarning>{fmtAgo(item.createdAt, now)}</span>
        {fresh && <span aria-label="New" className="size-2 rounded-full bg-green-primary" />}
      </div>
    </div>
  );
}
