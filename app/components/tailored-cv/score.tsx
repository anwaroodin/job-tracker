import { cn } from "~/lib/cn";
import type { AtsScore } from "~/types/cv";
import { Meter } from "~/components/ui/meter";

const METRICS = [
  { key: "keywordMatch", label: "Keywords" },
  { key: "skillsCoverage", label: "Skills" },
  { key: "sectionCompleteness", label: "Sections" },
] as const;

export function ScoreView({ before, after }: { before: AtsScore; after?: AtsScore }) {
  const final = after ?? before;
  const gain = after ? Math.round(after.overall) - Math.round(before.overall) : 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-baseline gap-2">
        <span className="text-[28px] font-medium leading-none tabular-nums text-text-primary">{Math.round(final.overall)}%</span>
        {after && (
          <span className={cn("text-[13px] tabular-nums", gain > 0 ? "text-green-primary" : "text-text-tertiary")}>
            {gain > 0 ? `+${gain}` : gain} from {Math.round(before.overall)}%
          </span>
        )}
      </p>

      <div className="flex flex-col gap-2.5">
        {METRICS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3 text-[13.5px]">
            <span className="w-20 shrink-0 text-text-secondary">{label}</span>
            <Meter share={final[key]} className={after ? "bg-green-primary" : undefined} />
            <span className="w-9 shrink-0 text-right font-medium tabular-nums text-text-primary">{Math.round(final[key])}</span>
          </div>
        ))}
      </div>

      {final.recommendations.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {final.recommendations.map((tip) => (
            <li key={tip} className="flex gap-2 text-[13px] leading-relaxed text-text-secondary">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-text-tertiary" />
              {tip}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12.5px] leading-relaxed text-text-tertiary">
        Overall is 55% keyword match, 25% skills coverage and 20% section completeness (summary, experience, education, skills).
      </p>
    </div>
  );
}
