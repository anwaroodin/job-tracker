import { Add01Icon, CheckmarkCircle02Icon, ChromeIcon, Download04Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useState } from "react";
import { Link, useFetcher, useRouteLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import type { loader as applicationsLoader } from "~/routes/app/applications/index";

const SANS = "h-9 font-sans text-[13.5px] normal-case tracking-normal";

function useHasUsedExtension() {
  const data = useRouteLoaderData<typeof applicationsLoader>("routes/app/applications/index");
  return Boolean(data && [...data.rows, ...data.saved].some((a) => a.url));
}

function Option({ icon, title, children }: { icon: IconSvgElement; title: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-4 px-6 py-5">
      <span className="grid size-10 shrink-0 place-items-center bg-ink/[0.06] text-text-primary">
        <HugeiconsIcon icon={icon} size={20} strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-text-primary">{title}</h3>
        {children}
      </div>
    </section>
  );
}

export function NewApplication() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<{ error?: string }>();
  const busy = fetcher.state !== "idle";
  const hasExtension = useHasUsedExtension();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={`${SANS} px-3.5`}>
        <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.5} />
        New application
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg gap-0 p-0 font-sans text-[14px] normal-case tracking-normal">
          <DialogHeader className="gap-1 border-b border-stroke-secondary px-6 pb-4 pt-5">
            <DialogTitle className="text-[17px] font-medium">Add an application</DialogTitle>
            <DialogDescription className="text-[13.5px] text-text-tertiary">Save it from the posting, or type it in.</DialogDescription>
          </DialogHeader>

          <Option icon={ChromeIcon} title="Save it from the job posting">
            <p className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">
              Open the job on LinkedIn, Indeed or any careers page and click Save in the j*b extension. It fills in the
              company, role, salary and description for you.
            </p>
            {hasExtension ? (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-green-primary">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.5} />
                You've saved jobs with the extension before
              </p>
            ) : (
              <Button asChild variant="secondary" size="small" className={`${SANS} mt-3 px-3`}>
                <Link to="/extension" onClick={() => setOpen(false)}>
                  <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.5} />
                  Get the extension
                </Link>
              </Button>
            )}
          </Option>

          <div className="flex items-center gap-3 px-6 text-[12.5px] text-text-tertiary" aria-hidden>
            <span className="h-px flex-1 bg-stroke-secondary" />
            or
            <span className="h-px flex-1 bg-stroke-secondary" />
          </div>

          <Option icon={Edit02Icon} title="Enter it yourself">
            <fetcher.Form method="post" className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="intent" value="create" />
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] text-text-tertiary">Company</span>
                <Input name="company" required maxLength={200} autoFocus placeholder="e.g. Monzo" className="h-9 text-[14px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] text-text-tertiary">Role</span>
                <Input name="role" required maxLength={200} placeholder="e.g. Graduate Software Engineer" className="h-9 text-[14px]" />
              </label>
              {fetcher.data?.error && (
                <p role="alert" className="text-[13px] text-red-primary">
                  {fetcher.data.error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className={SANS}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className={SANS}>
                  {busy ? "Adding…" : "Add application"}
                </Button>
              </div>
            </fetcher.Form>
          </Option>
        </DialogContent>
      </Dialog>
    </>
  );
}
