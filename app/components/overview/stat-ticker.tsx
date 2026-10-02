/** One figure in the header's ticker: `ACTIVE 12`. */
export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

export const TickerDivider = () => (
  <span aria-hidden className="select-none text-white/20">
    /
  </span>
);
