import { useEffect } from "react";
import { useBlocker, type BlockerFunction } from "react-router";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";

export function UnsavedDialog({
  dirty,
  leaving,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  leaving: (args: Parameters<BlockerFunction>[0]) => boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const blocker = useBlocker((args) => dirty && leaving(args));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const open = blocker.state === "blocked";
  const leave = (then: () => void) => {
    then();
    blocker.proceed?.();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && blocker.reset?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save your changes?</DialogTitle>
          <DialogDescription>You've edited this page without saving. Leave now and your changes are lost.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" className="text-red-primary hover:bg-red-quaternary hover:text-red-primary sm:mr-auto" onClick={() => leave(onDiscard)}>
            Discard changes
          </Button>
          <Button type="button" variant="ghost" onClick={() => blocker.reset?.()}>
            Keep editing
          </Button>
          <Button type="button" onClick={() => leave(onSave)}>
            Save and leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
