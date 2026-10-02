import { Check, Ellipsis, Trash2 } from "lucide-react";
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
import { fmtDate, STATUS_COLORS } from "~/components/ui/terminal";
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

function UnsureEmailRow({ email }: { email: UnsureEmail }) {
  const fetcher = useFetcher();
  if (fetcher.state !== "idle" || fetcher.data) return null;
  const submit = (fields: Record<string, string>) => fetcher.submit({ id: email.id, ...fields }, { method: "post" });

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate normal-case text-text-primary">{email.subject || "(No subject)"}</p>
        <p className="truncate normal-case text-text-tertiary">
          {email.fromName || email.fromAddress} · {fmtDate(email.receivedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="tiny" className="uppercase" onClick={() => submit({ intent: "not-job" })}>
          <Trash2 />
          Not about jobs
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Mark as job email">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 whitespace-nowrap font-mono uppercase tracking-[0.04em]">
            <DropdownMenuLabel>It's about a job: mark as</DropdownMenuLabel>
            {EMAIL_CATEGORIES.filter((c) => c !== "other").map((category) => (
              <DropdownMenuItem key={category} onSelect={() => submit({ intent: "label-email", category })}>
                <span aria-hidden className="size-[7px] shrink-0" style={{ background: STATUS_COLORS[category] ?? "#6e6f76" }} />
                {category}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => submit({ intent: "label-email", category: "other" })}>
              <Check />
              Keep, but not a stage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
