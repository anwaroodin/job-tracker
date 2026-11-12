import { Link } from "react-router";
import { cn } from "~/lib/cn";

/** Opens the job's tailoring page: `● CV` once a CV is tailored for it, `Tailor` until then. */
export function TailorLink({ id, tailored, className }: { id: string; tailored?: boolean; className?: string }) {
  return (
    <Link
      to={`/applications/${id}/cv`}
      title={tailored ? "Open the tailored CV" : "Tailor a CV for this job"}
      className={cn(
        "relative z-10 inline-flex items-center gap-1.5 font-sans text-[12.5px] font-medium normal-case tracking-normal transition-colors focus-visible:underline focus-visible:outline-none",
        tailored
          ? "text-green-primary hover:text-text-primary"
          : "text-text-tertiary hover:text-text-primary",
        className,
      )}
    >
      {tailored && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {tailored ? "CV" : "Tailor"}
    </Link>
  );
}
