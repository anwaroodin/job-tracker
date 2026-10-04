import { useFetcher } from "react-router";
import type { TimelineEmail } from "~/types/timeline";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { fmtDate } from "~/components/ui/terminal";

export interface MoveTarget {
  id: string;
  company: string;
  role: string;
  appliedAt: string;
}

export function MoveEmailDialog({
  email,
  company,
  applications,
  open,
  onOpenChange,
}: {
  email: TimelineEmail;
  company: string;
  applications: MoveTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetcher = useFetcher<{ error?: string }>();
  const busy = fetcher.state !== "idle";
  const sameCompany = (a: MoveTarget) => a.company.toLowerCase() === company.toLowerCase();
  const sorted = [...applications].sort(
    (a, b) => Number(sameCompany(b)) - Number(sameCompany(a)) || b.appliedAt.localeCompare(a.appliedAt),
  );
  const fieldClass = "w-full min-w-0 font-mono text-[12.5px] normal-case tracking-normal";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] font-mono uppercase tracking-[0.04em]">
        <DialogHeader>
          <DialogTitle className="font-normal">Wrong application</DialogTitle>
          <DialogDescription className="truncate font-sans normal-case">{email.subject || "(no subject)"}</DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="flex flex-col gap-2">
          <input type="hidden" name="intent" value="move" />
          <input type="hidden" name="id" value={email.id} />
          <input type="hidden" name="appliedAt" value={email.receivedAt ?? ""} />
          <p className="text-[11px] tracking-[0.1em] text-text-tertiary">New application</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input name="company" aria-label="Company" placeholder="Company" defaultValue={company} required maxLength={200} className={fieldClass} />
            <Input name="role" aria-label="Role" placeholder="Role" required maxLength={200} autoFocus className={fieldClass} />
          </div>
          <Button type="submit" disabled={busy} className="self-end">
            Create &amp; move
          </Button>
        </fetcher.Form>

        {sorted.length > 0 && (
          <fetcher.Form method="post" className="flex flex-col gap-2">
            <input type="hidden" name="intent" value="move" />
            <input type="hidden" name="id" value={email.id} />
            <label htmlFor="move-target" className="text-[11px] tracking-[0.1em] text-text-tertiary">
              Or an existing application
            </label>
            <select
              id="move-target"
              name="applicationId"
              required
              className="h-9 w-full min-w-0 border border-stroke-primary bg-fill-secondary px-2 font-mono text-[12.5px] normal-case tracking-normal text-text-primary"
            >
              {sorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} · {a.role} · {fmtDate(a.appliedAt)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary" disabled={busy} className="self-end">
              Move
            </Button>
          </fetcher.Form>
        )}

        {fetcher.data?.error && (
          <p role="alert" className="text-[11px] tracking-[0.08em] text-red-primary">
            {fetcher.data.error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
