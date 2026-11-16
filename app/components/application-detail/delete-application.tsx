import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";

export function DeleteApplication({ company, role }: { company: string; role: string }) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";
  return (
    <>
      <Button type="button" variant="ghost" size="tiny" className="hover:bg-red-quaternary hover:text-red-primary" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.5} />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete application</DialogTitle>
            <DialogDescription>
              {role} at {company}, with its tailored CVs and activity. Its emails stay in Gmail. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => fetcher.submit({ intent: "delete" }, { method: "post" })}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
