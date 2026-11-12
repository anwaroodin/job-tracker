import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button, type ButtonProps } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { EditableDetails } from "~/types/application";
import { cn } from "~/lib/cn";

type Field = { name: keyof EditableDetails; label: string; max: number; required?: boolean; placeholder?: string; options?: string[]; wide?: boolean };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "The job",
    fields: [
      { name: "company", label: "Company", max: 200, required: true },
      { name: "role", label: "Role", max: 200, required: true },
      { name: "url", label: "Job posting URL", max: 2048, placeholder: "https://", wide: true },
    ],
  },
  {
    title: "Terms",
    fields: [
      { name: "location", label: "Location", max: 200, placeholder: "e.g. London" },
      { name: "salary", label: "Salary", max: 100, placeholder: "e.g. £45k–£55k" },
      { name: "workType", label: "Work type", max: 50, placeholder: "Remote, hybrid or on-site", options: ["Remote", "Hybrid", "On-site"] },
      {
        name: "employmentType",
        label: "Employment",
        max: 50,
        placeholder: "Full-time, contract…",
        options: ["Full-time", "Part-time", "Contract", "Internship", "Graduate scheme"],
      },
    ],
  },
];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-ink/15 pt-4">
      <legend className="float-left mb-1 text-[12.5px] font-semibold text-text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

const LABEL ="text-[12.5px] text-text-secondary";

export function EditDetails({ job, variant = "ghost", size = "tiny" }: { job: EditableDetails } & Pick<ButtonProps, "variant" | "size">) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setOpen(false);
  }, [fetcher.state, fetcher.data]);

  return (
    <>
      <Button type="button" variant={variant} size={size} className="" onClick={() => setOpen(true)}>
        <Pencil />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 overflow-y-auto pb-0">
          <DialogHeader className="gap-1">
            <DialogTitle className="text-[16px] font-medium tracking-tight">Edit details</DialogTitle>
            <DialogDescription className="text-text-secondary">
              Leave a field empty to clear it.
            </DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="flex flex-col gap-7">
            <input type="hidden" name="intent" value="edit" />
            {GROUPS.map((g) => (
              <Group key={g.title} title={g.title}>
                <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
                  {g.fields.map((f) => (
                    <label key={f.name} className={cn("flex flex-col gap-1.5", f.wide && "sm:col-span-2")}>
                      <span className={LABEL}>
                        {f.label}
                        {f.required && <span className="text-text-tertiary"> *</span>}
                      </span>
                      <Input
                        name={f.name}
                        defaultValue={job[f.name] ?? ""}
                        required={f.required}
                        maxLength={f.max}
                        placeholder={f.placeholder}
                        list={f.options && `${f.name}-options`}
                        className=""
                      />
                      {f.options && (
                        <datalist id={`${f.name}-options`}>
                          {f.options.map((o) => (
                            <option key={o} value={o} />
                          ))}
                        </datalist>
                      )}
                    </label>
                  ))}
                </div>
              </Group>
            ))}
            <Group title="Notes">
              <Textarea
                name="notes"
                aria-label="Notes"
                defaultValue={job.notes}
                rows={3}
                maxLength={5_000}
                placeholder="Who you spoke to, what to mention next time…"
                className=""
              />
            </Group>
            <Group title="Job description">
              <Textarea
                name="description"
                aria-label="Job description"
                defaultValue={job.description}
                rows={7}
                maxLength={20_000}
                placeholder="Paste the posting so tailoring and interview prep can use it."
                className=""
              />
            </Group>
            {fetcher.data?.error && <p className="text-[13px] text-red-primary">{fetcher.data.error}</p>}
            <DialogFooter className="sticky bottom-0 -mx-6 gap-2 border-t border-stroke-primary bg-bg-secondary px-6 py-4">
              <Button type="button" variant="ghost" className="" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
