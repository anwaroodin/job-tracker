import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { RichText } from "~/components/ui/rich-text";

export function JobDescriptionPanel({ description }: { description: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <Button type="button" variant="secondary" size="tiny" className="uppercase" aria-expanded={open} aria-controls="job-description" onClick={() => setOpen(!open)}>
        {open ? "Hide job description" : "Job description"}
      </Button>
      {open && (
        <aside
          id="job-description"
          aria-label="Job description"
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[460px] flex-col border-l border-stroke-primary bg-bg-secondary"
        >
          <div className="flex items-center justify-between border-b border-stroke-secondary px-5 py-3 text-[11px] tracking-[0.12em] text-text-tertiary">
            Job description
            <Button type="button" variant="ghost" size="tiny" aria-label="Close job description" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <RichText text={description} className="text-[13.5px]" />
          </div>
        </aside>
      )}
    </>
  );
}
