import { SideBlock } from "~/components/ui/side-block";
import { cn } from "~/lib/cn";
import { CV_DESIGNS, type CvDesign } from "~/types/cv";

export function DesignPicker({ value, onChange }: { value: CvDesign; onChange: (design: CvDesign) => void }) {
  return (
    <SideBlock title="Design" aside="Used for every CV">
      <div role="radiogroup" aria-label="CV design" className="flex gap-1">
        {CV_DESIGNS.map((design) => {
          const active = design.value === value;
          return (
            <button
              key={design.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(design.value)}
              className={cn(
                "flex h-8 flex-1 cursor-pointer select-none items-center justify-center px-3 font-sans text-[13px] font-medium normal-case tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-text-secondary",
                active ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
              )}
            >
              {design.label}
            </button>
          );
        })}
      </div>
    </SideBlock>
  );
}
