import { Add01Icon, CheckmarkCircle02Icon, ChromeIcon, Download04Icon, Edit02Icon, Loading03Icon, Pdf01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher, useRouteLoaderData } from "react-router";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import type { JobFromPdf } from "~/lib/job-pdf";
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

const EXTRA_FIELDS: [keyof JobFromPdf, string][] = [
  ["description", "description"],
  ["location", "location"],
  ["salary", "salary"],
  ["workType", "work_type"],
  ["employmentType", "employment_type"],
];

function PdfPicker({ onRead }: { onRead: (job: JobFromPdf, fileName: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const fileName = useRef("");
  const fetcher = useFetcher<{ job?: JobFromPdf; error?: string }>();
  const reading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.job) onRead(fetcher.data.job, fileName.current);
  }, [fetcher.state, fetcher.data, onRead]);

  const read = (file: File | undefined) => {
    if (!file) return;
    fileName.current = file.name;
    const form = new FormData();
    form.set("intent", "read-job-pdf");
    form.set("file", file);
    fetcher.submit(form, { method: "post", action: "/applications?index", encType: "multipart/form-data" });
    if (input.current) input.current.value = "";
  };

  return (
    <div className="flex flex-col gap-1">
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(event) => read(event.target.files?.[0])} />
      <Button type="button" variant="secondary" size="small" disabled={reading} onClick={() => input.current?.click()} className={`${SANS} self-start px-3`}>
        <HugeiconsIcon icon={reading ? Loading03Icon : Pdf01Icon} size={16} strokeWidth={1.5} className={reading ? "animate-spin" : undefined} />
        {reading ? "Reading the PDF…" : "Fill in from a job description PDF"}
      </Button>
      {!reading && fetcher.data?.error && <p role="alert" className="text-[13px] text-red-primary">{fetcher.data.error}</p>}
    </div>
  );
}

function ReadSummary({ job, fileName }: { job: JobFromPdf; fileName: string }) {
  const read = [job.location, job.workType, job.employmentType, job.salary].filter(Boolean);
  const words = job.description.split(/\s+/).length;
  return (
    <p className="text-[12.5px] leading-relaxed text-text-tertiary">
      From {fileName}: {[...read, `${words.toLocaleString("en-GB")}-word description`].join(" · ")}. Check the company and role.
    </p>
  );
}

export function NewApplication() {
  const [open, setOpen] = useState(false);
  const [fromPdf, setFromPdf] = useState<{ job: JobFromPdf; fileName: string } | null>(null);
  const close = () => {
    setOpen(false);
    setFromPdf(null);
  };
  const showRead = useCallback((job: JobFromPdf, fileName: string) => setFromPdf({ job, fileName }), []);
  const fetcher = useFetcher<{ error?: string }>();
  const busy = fetcher.state !== "idle";
  const hasExtension = useHasUsedExtension();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={`${SANS} px-3.5`}>
        <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.5} />
        New application
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
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
                <Link to="/extension" onClick={close}>
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
              <PdfPicker onRead={showRead} />
              {fromPdf && EXTRA_FIELDS.map(([field, name]) => <input key={name} type="hidden" name={name} value={fromPdf.job[field]} />)}
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] text-text-tertiary">Company</span>
                <Input key={`company-${fromPdf?.fileName}`} name="company" required maxLength={200} autoFocus defaultValue={fromPdf?.job.company} placeholder="e.g. Monzo" className="h-9 text-[14px]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12.5px] text-text-tertiary">Role</span>
                <Input key={`role-${fromPdf?.fileName}`} name="role" required maxLength={200} defaultValue={fromPdf?.job.role} placeholder="e.g. Graduate Software Engineer" className="h-9 text-[14px]" />
              </label>
              {fromPdf && <ReadSummary job={fromPdf.job} fileName={fromPdf.fileName} />}
              {fetcher.data?.error && (
                <p role="alert" className="text-[13px] text-red-primary">
                  {fetcher.data.error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={close} className={SANS}>
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
