import { Link } from "react-router";
import { cn } from "~/lib/cn";

/** Opens the job's tailoring page: `● CV` once a CV is tailored for it, `Tailor` until then. */
export function TailorLink({ id, tailored, className }: { id: string; tailored?: boolean; className?: string }) {
  return (
    <Link
      to={`/applications/${id}/cv`}
      title={tailored ? "Open the tailored CV" : "Tailor a CV for this job"}
      className={cn(
        "relative z-10 inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] transition-colors focus-visible:underline focus-visible:outline-none",
        tailored
          ? "text-green-primary hover:text-text-primary group-hover:!text-text-inverse"
          : "text-text-tertiary hover:text-text-primary group-hover:!text-text-inverse/70 group-hover:hover:!text-text-inverse",
        className,
      )}
    >
      {tailored && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {tailored ? "CV" : "Tailor"}
    </Link>
  );
}
