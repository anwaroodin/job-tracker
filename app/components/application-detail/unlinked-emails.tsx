import { Link2 } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import type { TimelineEmail } from "~/types/timeline";
import { fmtDate } from "~/components/ui/terminal";

export function UnlinkedEmails({ emails }: { emails: TimelineEmail[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="uppercase text-[11px] tracking-[0.08em] text-text-tertiary transition-colors hover:text-text-primary"
      >
        {emails.length} unlinked {emails.length === 1 ? "email" : "emails"} · {open ? "Hide" : "Show"}
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-1">
          {emails.map((email) => (
            <UnlinkedEmail key={email.id} email={email} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UnlinkedEmail({ email }: { email: TimelineEmail }) {
  const fetcher = useFetcher();
  return (
    <li className="flex items-center gap-4 py-1.5">
      <span className="hidden w-[96px] shrink-0 text-[11px] tracking-[0.08em] text-text-tertiary sm:block">
        {email.receivedAt ? fmtDate(email.receivedAt) : "—"}
      </span>
      <span className="min-w-0 flex-1 truncate font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
        {email.subject || "(no subject)"}
      </span>
      <button
        type="button"
        disabled={fetcher.state !== "idle"}
        onClick={() => fetcher.submit({ intent: "relink", id: email.id }, { method: "post" })}
        className="flex shrink-0 items-center gap-1.5 uppercase text-[10.5px] tracking-[0.1em] text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-40"
      >
        <Link2 className="size-3.5" />
        Relink
      </button>
    </li>
  );
}
