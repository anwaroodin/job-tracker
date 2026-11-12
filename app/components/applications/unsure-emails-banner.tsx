import { Delete02Icon, MoreHorizontalIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { StatusBadge } from "~/components/ui/status-badge";
import { shortDate } from "~/components/ui/terminal";
import { EMAIL_CATEGORIES } from "~/lib/email";
import type { UnsureEmail } from "~/types/unsure-email";

export function UnsureEmailsBanner({ emails }: { emails: UnsureEmail[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-dashed border-stroke-secondary bg-fill-secondary/40 px-3.5 py-2.5 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-text-secondary">
          {emails.length} {emails.length === 1 ? "email" : "emails"} might not be about jobs. Kept until you decide.
        </span>
        <Button type="button" variant="ghost" size="tiny" className="uppercase" onClick={() => setOpen((o) => !o)}>
          {open ? "[Hide ▲]" : "[Review ▼]"}
        </Button>
      </div>
      {open && (
        <ul className="mt-3 divide-y divide-dashed divide-stroke-primary/50 border-t border-dashed border-stroke-secondary/60">
          {emails.map((email) => (
            <UnsureEmailRow key={email.id} email={email} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function UnsureEmailRow({ email }: { email: UnsureEmail }) {
  const fetcher = useFetcher();
  if (fetcher.state !== "idle" || fetcher.data) return null;
  const submit = (fields: Record<string, string>) => fetcher.submit({ id: email.id, ...fields }, { method: "post" });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 font-sans text-[14px] normal-case tracking-normal">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{email.subject || "(No subject)"}</p>
        <p className="truncate text-[12.5px] text-text-tertiary">
          {email.fromName || email.fromAddress} · {shortDate(email.receivedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="small"
          className="font-sans text-[13px] normal-case tracking-normal"
          onClick={() => submit({ intent: "not-job" })}
        >
          <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.5} />
          Not about jobs
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Mark as job email">
              <HugeiconsIcon icon={MoreHorizontalIcon} size={16} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52 whitespace-nowrap font-sans text-[13px] normal-case tracking-normal">
            <DropdownMenuLabel>It's about a job: mark as</DropdownMenuLabel>
            {EMAIL_CATEGORIES.filter((c) => c !== "other").map((category) => (
              <DropdownMenuItem key={category} onSelect={() => submit({ intent: "label-email", category })}>
                <StatusBadge status={category} variant="dot" />
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => submit({ intent: "label-email", category: "other" })}>
              <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={1.5} />
              Keep, but not a stage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
