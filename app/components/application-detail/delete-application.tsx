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
      <Button type="button" variant="ghost" size="tiny" className="uppercase" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] font-mono uppercase tracking-[0.04em]">
          <DialogHeader>
            <DialogTitle className="font-normal">Delete application</DialogTitle>
            <DialogDescription className="font-sans normal-case">
              {role} at {company}, with its tailored CVs and activity. Its emails stay in Gmail. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="uppercase" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="uppercase" disabled={busy} onClick={() => fetcher.submit({ intent: "delete" }, { method: "post" })}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
