import { BarRow } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { AtsScore } from "~/types/cv";

type Keyword = AtsScore["keywords"][number];
type Status = "missing" | "dropped" | "added" | "match";

const GROUPS: { kind: Keyword["kind"]; label: string }[] = [
  { kind: "required", label: "Required" },
  { kind: "preferred", label: "Preferred" },
  { kind: "keyword", label: "Keywords" },
];

const STATUS: Record<Status, { order: number; className: string; title: string }> = {
  missing: { order: 0, className: "text-red-primary", title: "Not in your CV or the tailored CV" },
  dropped: { order: 1, className: "text-accent-primary", title: "In your CV but not in the tailored CV" },
  added: { order: 2, className: "text-green-primary", title: "Brought in by tailoring" },
  match: { order: 3, className: "text-text-tertiary", title: "In your CV" },
};

function status(inCv: boolean, inTailored: boolean | undefined): Status {
  const now = inTailored ?? inCv;
  if (now) return inCv ? "match" : "added";
  return inCv ? "dropped" : "missing";
}

export function KeywordGroups({ before, after }: { before: AtsScore; after?: AtsScore }) {
  const tailored = after && new Map(after.keywords.map((k) => [k.term, k.found]));

  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map(({ kind, label }) => {
        const terms = before.keywords
          .filter((k) => k.kind === kind)
          .map((k) => ({ term: k.term, status: status(k.found, tailored?.get(k.term)) }))
          .sort((a, b) => STATUS[a.status].order - STATUS[b.status].order);
        if (!terms.length) return null;
        const covered = terms.filter((t) => t.status === "match" || t.status === "added").length;
        const was = terms.filter((t) => t.status === "match" || t.status === "dropped").length;
        return (
          <div key={kind}>
            <BarRow
              label={label}
              value={`${covered}/${terms.length}`}
              share={(covered / terms.length) * 100}
              color={covered === terms.length ? "var(--color-green-primary)" : "var(--color-text-secondary)"}
              cells={28}
              valueClass="w-12"
              noteClass="w-20"
              note={after && was !== covered ? `was ${was}/${terms.length}` : undefined}
            />
            <ul className="mt-1 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {terms.map(({ term, status }) => (
                <li key={term} className="flex items-baseline justify-between gap-3 border-b border-stroke-secondary py-1.5" title={STATUS[status].title}>
                  <span className={cn("min-w-0 truncate font-sans text-[13px] normal-case tracking-normal", status === "missing" ? "text-text-secondary" : "text-text-primary")}>
                    {term}
                  </span>
                  <span className={cn("shrink-0 text-[10.5px] tracking-[0.08em]", STATUS[status].className)}>[{status}]</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
