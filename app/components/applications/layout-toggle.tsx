import { KanbanIcon, LeftToRightListBulletIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "~/lib/cn";
import { applicationsLayout$ } from "~/lib/state/applications-layout";

const LAYOUTS = [
  { label: "Table", icon: LeftToRightListBulletIcon, board: false },
  { label: "Board", icon: KanbanIcon, board: true },
];

export function LayoutToggle({ board }: { board: boolean }) {
  return (
    <span className="flex gap-0.5 font-sans normal-case tracking-normal">
      {LAYOUTS.map((layout) => {
        const on = layout.board === board;
        return (
          <button
            key={layout.label}
            type="button"
            aria-pressed={on}
            title={layout.label}
            onClick={() => applicationsLayout$.board.set(layout.board)}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors",
              on ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
            )}
          >
            <HugeiconsIcon icon={layout.icon} size={16} strokeWidth={1.5} />
            <span className="hidden sm:inline">{layout.label}</span>
          </button>
        );
      })}
    </span>
  );
}
