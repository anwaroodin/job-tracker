import { Check, Ellipsis, Unlink } from "lucide-react";
import { useFetcher } from "react-router";
import type { TimelineEmail } from "~/types/timeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { STATUS_COLORS } from "~/components/ui/terminal";
import { EMAIL_CATEGORIES } from "~/lib/email";

export function EmailActions({ email, unlinkOnly }: { email: TimelineEmail; unlinkOnly?: boolean }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const pendingCategory = fetcher.formData?.get("category");
  const current = typeof pendingCategory === "string" ? pendingCategory : email.category;
  const submit = (fields: Record<string, string>) => fetcher.submit({ id: email.id, ...fields }, { method: "post" });
  const confirm = () => submit({ intent: "categorize", category: email.category ?? "other" });
  const unsure = email.unsure && !unlinkOnly && fetcher.formData?.get("intent") !== "categorize";

  return (
    <div className="mt-2 flex shrink-0 items-center gap-1">
      {unsure && (
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          title={`Jev wasn't sure. Confirm this email really is ${email.category}.`}
          className="flex h-7 items-center gap-1.5 px-2 text-[10.5px] uppercase tracking-[0.1em] text-accent-primary transition-colors hover:bg-white/[0.06] hover:text-accent-secondary focus-visible:bg-white/[0.06] focus-visible:outline-none disabled:opacity-40"
        >
          <Check className="size-3.5" />
          Confirm
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Email actions"
            disabled={busy}
            className="flex size-7 shrink-0 items-center justify-center text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:bg-white/[0.06] focus-visible:text-text-primary focus-visible:outline-none disabled:opacity-40 data-[state=open]:bg-white/[0.06] data-[state=open]:text-text-primary"
          >
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 whitespace-nowrap font-mono uppercase tracking-[0.04em]">
          {!unlinkOnly && (
            <>
              {unsure && (
                <>
                  <DropdownMenuItem onSelect={confirm}>
                    <Check />
                    Confirm as {email.category}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuLabel>Mark as</DropdownMenuLabel>
              {EMAIL_CATEGORIES.map((category) => (
                <DropdownMenuItem
                  key={category}
                  disabled={category === current && !unsure}
                  onSelect={() => submit({ intent: "categorize", category })}
                >
                  <span
                    aria-hidden
                    className="size-[7px] shrink-0"
                    style={{ background: STATUS_COLORS[category] ?? "#6e6f76" }}
                  />
                  {category}
                  {category === current && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => submit({ intent: "unlink" })}>
            <Unlink />
            Unlink from application
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
