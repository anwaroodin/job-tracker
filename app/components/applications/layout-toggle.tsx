import { cn } from "~/lib/cn";
import { applicationsLayout$ } from "~/lib/state/applications-layout";

export function LayoutToggle({ board }: { board: boolean }) {
  return (
    <span className="flex">
      {(["Table", "Board"] as const).map((label) => {
        const on = (label === "Board") === board;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => applicationsLayout$.board.set(label === "Board")}
            className={cn(
              "cursor-pointer border border-stroke-primary px-2 py-0.5 uppercase tracking-[0.06em] transition-colors",
              on ? "bg-text-primary text-text-inverse" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </span>
  );
}
