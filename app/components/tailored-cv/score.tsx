import { BarRow } from "~/components/ui/terminal";
import type { AtsScore } from "~/types/cv";
import { KeywordGroups } from "./keyword-groups";

const GREEN = "var(--color-green-primary)";
const MUTED = "var(--color-text-tertiary)";
const METRICS = [
  { key: "overall", label: "Overall" },
  { key: "keywordMatch", label: "Keywords" },
  { key: "skillsCoverage", label: "Skills" },
  { key: "sectionCompleteness", label: "Sections" },
] as const;

export function ScoreView({ before, after }: { before: AtsScore; after?: AtsScore }) {
  const final = after ?? before;

  return (
    <div className="flex flex-col gap-6">
      <div>
        {METRICS.map(({ key, label }) => (
          <BarRow
            key={key}
            label={label}
            value={Math.round(final[key])}
            share={final[key]}
            color={after ? GREEN : MUTED}
            cells={28}
            note={after ? `was ${Math.round(before[key])}` : undefined}
          />
        ))}
        <p className="mt-3 max-w-3xl font-sans text-[12.5px] normal-case leading-relaxed tracking-normal text-text-tertiary">
          Overall is 55% keyword match (the job's skills and keywords found anywhere in the CV), 25% skills coverage (required and preferred skills
          found) and 20% section completeness (summary, experience, education, skills).
        </p>
      </div>

      <ul className="flex flex-col gap-1">
        {final.recommendations.map((tip) => (
          <li key={tip} className="flex gap-2.5 font-sans text-[13px] normal-case tracking-normal text-text-secondary">
            <span className="text-text-tertiary">—</span>
            {tip}
          </li>
        ))}
      </ul>

      <KeywordGroups before={before} after={after} />
    </div>
  );
}
