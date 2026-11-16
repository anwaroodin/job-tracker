import { ArrowDataTransferHorizontalIcon, MoreHorizontalIcon, Tick02Icon, Unlink03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useState } from "react";
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
import { StatusBadge } from "~/components/ui/status-badge";
import { EMAIL_CATEGORIES } from "~/lib/email";
import { MoveEmailDialog, type MoveTarget } from "~/components/application-detail/move-email-dialog";

const Icon = ({ icon, size = 16, className }: { icon: IconSvgElement; size?: number; className?: string }) => (
  <HugeiconsIcon icon={icon} size={size} strokeWidth={1.5} className={className} />
);

export function EmailActions({
  email,
  unlinkOnly,
  move,
}: {
  email: TimelineEmail;
  unlinkOnly?: boolean;
  move?: { company: string; applications: MoveTarget[] };
}) {
  const fetcher = useFetcher();
  const [moving, setMoving] = useState(false);
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
          className="flex h-7 items-center gap-1.5 px-2 text-[12.5px] text-accent-primary transition-colors hover:bg-ink/[0.06] hover:text-accent-secondary focus-visible:bg-ink/[0.06] focus-visible:outline-none disabled:opacity-40"
        >
          <Icon icon={Tick02Icon} size={14} />
          Confirm
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Email actions"
            disabled={busy}
            className="flex size-7 shrink-0 items-center justify-center text-text-tertiary transition-colors hover:bg-ink/[0.06] hover:text-text-primary focus-visible:bg-ink/[0.06] focus-visible:text-text-primary focus-visible:outline-none disabled:opacity-40 data-[state=open]:bg-ink/[0.06] data-[state=open]:text-text-primary"
          >
            <Icon icon={MoreHorizontalIcon} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 whitespace-nowrap">
          {!unlinkOnly && (
            <>
              {unsure && (
                <>
                  <DropdownMenuItem onSelect={confirm}>
                    <Icon icon={Tick02Icon} />
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
                  <StatusBadge status={category} variant="dot" />
                  {category === current && <Icon icon={Tick02Icon} className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          {move && (
            <DropdownMenuItem onSelect={() => setMoving(true)}>
              <Icon icon={ArrowDataTransferHorizontalIcon} />
              Wrong application…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => submit({ intent: "unlink" })}>
            <Icon icon={Unlink03Icon} />
            Unlink from application
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {move && (
        <MoveEmailDialog
          email={email}
          company={move.company}
          applications={move.applications}
          open={moving}
          onOpenChange={setMoving}
        />
      )}
    </div>
  );
}
