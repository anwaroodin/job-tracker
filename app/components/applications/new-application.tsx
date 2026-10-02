import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

/**
 * "+ New application": opens an inline company + role form that logs an
 * application by hand. The route action redirects to the new application.
 */
export function NewApplication() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<{ error?: string }>();
  const busy = fetcher.state !== "idle";

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + New application
      </Button>
    );
  }

  return (
    <fetcher.Form method="post" className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="intent" value="create" />
      <Input
        name="company"
        aria-label="Company"
        placeholder="Company"
        required
        maxLength={200}
        autoFocus
        className="w-full sm:w-44 font-mono text-[12.5px] normal-case tracking-normal"
      />
      <Input
        name="role"
        aria-label="Role"
        placeholder="Role"
        required
        maxLength={200}
        className="w-full sm:w-56 font-mono text-[12.5px] normal-case tracking-normal"
      />
      <Button type="submit" disabled={busy}>
        {busy ? "Adding…" : "Add"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {fetcher.data?.error && (
        <p role="alert" className="w-full text-right text-[11px] tracking-[0.08em] text-red-primary">
          {fetcher.data.error}
        </p>
      )}
    </fetcher.Form>
  );
}
