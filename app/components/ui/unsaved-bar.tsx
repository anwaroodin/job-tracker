export function UnsavedBar({ children }: { children: React.ReactNode }) {
  return (
    <aside
      aria-label="Unsaved changes"
      className="fixed bottom-[calc(var(--bottom-nav)+1.5rem)] right-6 z-30 flex items-center gap-4 border border-stroke-primary bg-bg-secondary/95 px-5 py-3 shadow-xl backdrop-blur-sm sm:right-10"
    >
      <span className="text-[11px] text-text-tertiary">Unsaved changes</span>
      {children}
    </aside>
  );
}
