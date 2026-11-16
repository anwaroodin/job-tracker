import { ArrowUpRight01Icon, Copy01Icon, MailSend01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

interface Props {
  quietDays: number;
  account: string;
  to: string;
  subject: string;
  body: string;
  threadUrl: string | null;
  composeUrl: string;
}

export function FollowUp({ quietDays, account, to, subject, body, threadUrl, composeUrl }: Props) {
  const fetcher = useFetcher();
  const [copied, setCopied] = useState(false);
  if (fetcher.state !== "idle" || fetcher.data) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(body).catch(() => {});
    setCopied(true);
  };

  return (
    <section id="follow-up" aria-label="Follow up" className="scroll-mt-20 border border-stroke-secondary">
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span className="grid size-9 shrink-0 place-items-center bg-accent-quaternary text-accent-primary">
          <HugeiconsIcon icon={MailSend01Icon} size={18} strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-text-primary">No reply in {quietDays} days</p>
          <p className="text-[13.5px] text-text-secondary">
            {threadUrl
              ? "A short follow-up often gets a stalled application looked at. Open your last conversation with them, click Reply and paste the draft."
              : "A short follow-up often gets a stalled application looked at. Here's a draft to edit and send."}
          </p>
        </div>
      </div>

      <div className="mx-4 flex flex-col gap-2.5 border-y border-stroke-secondary py-3">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-text-tertiary">From</dt>
          <dd className="truncate text-text-primary">{account}</dd>
          <dt className="text-text-tertiary">To</dt>
          <dd className="truncate text-text-primary">{to || "Add the recruiter in Gmail"}</dd>
          <dt className="text-text-tertiary">Subject</dt>
          <dd className="truncate text-text-primary">{subject}</dd>
        </dl>
        <p className="whitespace-pre-line bg-ink/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-text-secondary">{body}</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
        <fetcher.Form method="post" className="mr-auto">
          <Button type="submit" name="intent" value="followed-up" variant="ghost" size="small">
            I've followed up
          </Button>
        </fetcher.Form>
        <Button type="button" variant="secondary" size="small" onClick={copy}>
          <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={16} strokeWidth={1.5} />
          {copied ? "Copied" : "Copy draft"}
        </Button>
        <Button asChild size="small">
          <a href={threadUrl ?? composeUrl} target="_blank" rel="noopener noreferrer" onClick={threadUrl ? copy : undefined}>
            {threadUrl ? "Reply in Gmail" : "Draft in Gmail"}
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={1.5} />
          </a>
        </Button>
      </div>
    </section>
  );
}
