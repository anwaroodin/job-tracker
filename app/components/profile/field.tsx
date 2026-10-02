import { cn } from "~/lib/cn";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow !text-[10px]">{label}</span>
      {children}
    </label>
  );
}

export function FieldGrid({
  cols,
  children,
}: {
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        cols === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}
