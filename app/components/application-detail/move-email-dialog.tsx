import { useFetcher } from "react-router";
import type { TimelineEmail } from "~/types/timeline";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { shortDate } from "~/components/ui/terminal";

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
  const field = "h-9 w-full min-w-0 text-[13.5px]";
  const button = "h-9 px-3.5 text-[13.5px]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wrong application</DialogTitle>
          <DialogDescription className="truncate">{email.subject || "(no subject)"}</DialogDescription>
        </DialogHeader>

        <fetcher.Form method="post" className="flex flex-col gap-3 px-6 py-5">
          <input type="hidden" name="intent" value="move" />
          <input type="hidden" name="id" value={email.id} />
          <input type="hidden" name="appliedAt" value={email.receivedAt ?? ""} />
          <h3 className="font-medium text-text-primary">Move it to a new application</h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[12.5px] text-text-tertiary">Company</span>
              <Input name="company" defaultValue={company} required maxLength={200} className={field} />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[12.5px] text-text-tertiary">Role</span>
              <Input name="role" placeholder="e.g. Graduate Software Engineer" required maxLength={200} autoFocus className={field} />
            </label>
          </div>
          <Button type="submit" disabled={busy} className={`${button} self-end`}>
            Create and move
          </Button>
        </fetcher.Form>

        {sorted.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-6 text-[12.5px] text-text-tertiary" aria-hidden>
              <span className="h-px flex-1 bg-stroke-secondary" />
              or
              <span className="h-px flex-1 bg-stroke-secondary" />
            </div>
            <fetcher.Form method="post" className="flex flex-col gap-3 px-6 py-5">
              <input type="hidden" name="intent" value="move" />
              <input type="hidden" name="id" value={email.id} />
              <label htmlFor="move-target" className="font-medium text-text-primary">
                Move it to an existing application
              </label>
              <select
                id="move-target"
                name="applicationId"
                required
                className="h-9 w-full min-w-0 border border-stroke-secondary bg-bg-primary px-2 text-[13.5px] text-text-primary hover:border-stroke-primary"
              >
                {sorted.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company} · {a.role} · {shortDate(a.appliedAt)}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="secondary"
                disabled={busy}
                className={`${button} self-end border-stroke-secondary bg-bg-primary text-text-primary hover:border-stroke-primary hover:bg-bg-primary`}
              >
                Move
              </Button>
            </fetcher.Form>
          </>
        )}

        {fetcher.data?.error && (
          <p role="alert" className="px-6 pb-5 text-[13px] text-red-primary">
            {fetcher.data.error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
