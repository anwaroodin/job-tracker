import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button, type ButtonProps } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { EditableDetails } from "~/types/application";

const FIELDS: { name: keyof EditableDetails; label: string; max: number; required?: boolean }[] = [
  { name: "company", label: "Company", max: 200, required: true },
  { name: "role", label: "Role", max: 200, required: true },
  { name: "location", label: "Location", max: 200 },
  { name: "workType", label: "Work type", max: 50 },
  { name: "employmentType", label: "Employment", max: 50 },
  { name: "salary", label: "Salary", max: 100 },
  { name: "url", label: "Job posting URL", max: 2048 },
];

export function EditDetails({ job, variant = "ghost", size = "tiny" }: { job: EditableDetails } & Pick<ButtonProps, "variant" | "size">) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setOpen(false);
  }, [fetcher.state, fetcher.data]);

  const label = "text-[10.5px] tracking-[0.1em] text-text-tertiary";
  return (
    <>
      <Button type="button" variant={variant} size={size} className="uppercase" onClick={() => setOpen(true)}>
        <Pencil />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl grid-cols-[minmax(0,1fr)] overflow-y-auto font-mono uppercase tracking-[0.04em]">
          <DialogHeader>
            <DialogTitle className="font-normal">Edit details</DialogTitle>
            <DialogDescription className="font-sans normal-case">Leave a field empty to clear it.</DialogDescription>
          </DialogHeader>
          <fetcher.Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="intent" value="edit" />
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <label key={f.name} className={`flex flex-col gap-1.5 ${f.name === "url" ? "sm:col-span-2" : ""}`}>
                  <span className={label}>{f.label}</span>
                  <Input name={f.name} defaultValue={job[f.name] ?? ""} required={f.required} maxLength={f.max} className="font-sans normal-case" />
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Notes</span>
              <Textarea name="notes" defaultValue={job.notes} rows={3} maxLength={5_000} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Job description</span>
              <Textarea name="description" defaultValue={job.description} rows={12} maxLength={20_000} className="font-sans" />
            </label>
            {fetcher.data?.error && <p className="font-sans text-[13px] normal-case text-red-primary">{fetcher.data.error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" className="uppercase" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="uppercase" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
