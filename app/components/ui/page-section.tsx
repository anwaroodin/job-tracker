export const SANS_PAGE =
  "font-sans text-[14px] normal-case tracking-normal [&_button]:font-sans [&_button]:normal-case [&_button]:tracking-normal";

export function PageSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16">
      <header className="mb-5 border-b border-stroke-secondary pb-3">
        <h2 className="text-[16px] font-medium text-text-primary">{title}</h2>
        {description && <p className="mt-0.5 text-[13.5px] text-text-tertiary">{description}</p>}
      </header>
      {children}
    </section>
  );
}
