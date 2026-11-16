import { Button } from "~/components/ui/button";

export function UnsavedBar({ onDiscard, busy, children }: { onDiscard: () => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <aside
      aria-label="Unsaved changes"
      className="fixed inset-x-4 bottom-[calc(var(--bottom-nav)+1rem)] z-30 border border-stroke-primary bg-sidebar-active font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)] sm:inset-x-auto sm:bottom-[calc(var(--bottom-nav)+1.5rem)] sm:right-6 sm:w-full sm:max-w-sm [&_button]:font-sans [&_button]:normal-case [&_button]:tracking-normal"
    >
      <div className="px-4 pb-1 pt-3">
        <p className="flex items-center gap-2 font-medium text-text-primary">
          <span aria-hidden className="size-2 rounded-full bg-accent-primary" />
          Unsaved changes
        </p>
        <p className="mt-0.5 pl-4 text-[13px] text-text-tertiary">Save them before you leave this page.</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-4 pb-3 pt-2 [&_button]:h-8 [&_button]:px-3 [&_button]:text-[13px]">
        <Button type="button" variant="ghost" disabled={busy} onClick={onDiscard}>
          Discard
        </Button>
        {children}
      </div>
    </aside>
  );
}
