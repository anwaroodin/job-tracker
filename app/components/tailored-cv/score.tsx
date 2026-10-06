import { BarRow } from "~/components/ui/terminal";
import type { AtsScore } from "~/types/cv";

const GREEN = "var(--color-green-primary)";
const MUTED = "var(--color-text-tertiary)";
const KIND_LABEL = { required: "Required skill", preferred: "Preferred skill", keyword: "Keyword" };
const METRICS = [
  { key: "overall", label: "Overall" },
  { key: "keywordMatch", label: "Keywords" },
  { key: "skillsCoverage", label: "Skills" },
  { key: "sectionCompleteness", label: "Sections" },
] as const;

function Mark({ on }: { on: boolean | undefined }) {
  if (on === undefined) return <span className="text-text-tertiary">—</span>;
  return <span className={on ? "text-green-primary" : "text-red-primary"}>{on ? "[yes]" : "[no]"}</span>;
}

export function ScoreView({ before, after }: { before: AtsScore; after?: AtsScore }) {
  const final = after ?? before;
  const tailoredFound = new Map(after?.keywords.map((k) => [k.term, k.found]));

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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr className="border-b border-stroke-secondary text-left text-[10.5px] tracking-[0.1em] text-text-tertiary">
              <th className="py-2 pr-3 font-normal">From the job</th>
              <th className="py-2 pr-3 font-normal">Type</th>
              <th className="py-2 pr-3 font-normal">Your CV</th>
              {after && <th className="py-2 font-normal">Tailored</th>}
            </tr>
          </thead>
          <tbody>
            {before.keywords.map((k) => (
              <tr key={k.term} className="border-b border-stroke-secondary text-[11px] tracking-[0.08em]">
                <td className="py-2.5 pr-3 font-sans text-[13px] normal-case tracking-normal text-text-primary">{k.term}</td>
                <td className="py-2.5 pr-3 text-text-tertiary">{KIND_LABEL[k.kind]}</td>
                <td className="py-2.5 pr-3">
                  <Mark on={k.found} />
                </td>
                {after && (
                  <td className="py-2.5">
                    <Mark on={tailoredFound.get(k.term)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
