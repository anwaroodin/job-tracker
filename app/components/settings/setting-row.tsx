export function Setting({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <div className="max-w-md">
        <p className="font-medium text-text-primary">{label}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-text-tertiary">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
