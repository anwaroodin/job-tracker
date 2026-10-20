import { PanelRight } from "lucide-react";
import { useMatches } from "react-router";
import { RichText } from "~/components/ui/rich-text";
import { usePersisted } from "~/hooks/use-persisted";
import { cn } from "~/lib/cn";
import { sidePanel$ } from "~/lib/state/side-panel";

export type SidePanelContent = { title: string; text: string } | null;
export type SidePanelHandle = { sidePanel: (data: never) => SidePanelContent };

const hasPanel = (handle: unknown): handle is SidePanelHandle =>
  typeof (handle as SidePanelHandle | undefined)?.sidePanel === "function";

/** A route's `handle.sidePanel(loaderData)` docks its content on the right, beside the page. */
export function SidePanel() {
  const collapsed = usePersisted(() => sidePanel$.collapsed.get(), false);
  const match = [...useMatches()].reverse().find((m) => hasPanel(m.handle));
  const content = match && hasPanel(match.handle) ? match.handle.sidePanel(match.loaderData as never) : null;
  if (!content) return null;

  const toggle = (
    <button
      type="button"
      onClick={() => sidePanel$.collapsed.set(!collapsed)}
      aria-expanded={!collapsed}
      aria-controls="side-panel-body"
      title={collapsed ? `Show ${content.title.toLowerCase()}` : `Hide ${content.title.toLowerCase()}`}
      className="flex shrink-0 cursor-pointer items-center justify-center p-2 text-text-tertiary transition-colors hover:bg-fill-tertiary hover:text-text-primary"
    >
      <PanelRight className="size-3.5" />
    </button>
  );

  return (
    <aside
      aria-label={content.title}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col self-start border-l border-stroke-secondary bg-bg-secondary lg:flex",
        collapsed ? "w-[44px] items-center pt-3" : "w-[380px] xl:w-[420px]",
      )}
    >
      {collapsed ? (
        <>
          {toggle}
          <button
            type="button"
            onClick={() => sidePanel$.collapsed.set(false)}
            className="mt-4 cursor-pointer font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary transition-colors [writing-mode:vertical-rl] hover:text-text-primary"
          >
            {content.title}
          </button>
        </>
      ) : (
        <>
          <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-stroke-secondary pl-5 pr-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
            {content.title}
            {toggle}
          </div>
          <div id="side-panel-body" className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <RichText text={content.text} className="text-[13.5px]" />
          </div>
        </>
      )}
    </aside>
  );
}
