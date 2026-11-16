import { Meter } from "~/components/ui/meter";
import { cn } from "~/lib/cn";
import type { AtsScore } from "~/types/cv";

type Keyword = AtsScore["keywords"][number];
type Status = "missing" | "dropped" | "added" | "match";

const GROUPS: { kind: Keyword["kind"]; label: string }[] = [
  { kind: "required", label: "Required" },
  { kind: "preferred", label: "Preferred" },
  { kind: "keyword", label: "Keywords" },
];

const STATUS: Record<Status, { order: number; label: string; dot: string; title: string }> = {
  missing: { order: 0, label: "Missing", dot: "bg-red-primary", title: "Not in your CV or the tailored CV" },
  dropped: { order: 1, label: "Dropped", dot: "bg-accent-primary", title: "In your CV but not in the tailored CV" },
  added: { order: 2, label: "Added", dot: "bg-green-primary", title: "Brought in by tailoring" },
  match: { order: 3, label: "In your CV", dot: "bg-text-tertiary", title: "In your CV" },
};

function status(inCv: boolean, inTailored: boolean | undefined): Status {
  const now = inTailored ?? inCv;
  if (now) return inCv ? "match" : "added";
  return inCv ? "dropped" : "missing";
}

export function KeywordGroups({ before, after }: { before: AtsScore; after?: AtsScore }) {
  const tailored = after && new Map(after.keywords.map((k) => [k.term, k.found]));

  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map(({ kind, label }) => {
        const terms = before.keywords
          .filter((k) => k.kind === kind)
          .map((k) => ({ term: k.term, status: status(k.found, tailored?.get(k.term)) }))
          .sort((a, b) => STATUS[a.status].order - STATUS[b.status].order);
        if (!terms.length) return null;
        const covered = terms.filter((t) => t.status === "match" || t.status === "added").length;
        const was = terms.filter((t) => t.status === "match" || t.status === "dropped").length;
        return (
          <section key={kind} className="flex flex-col gap-2">
            <header className="flex items-center gap-3">
              <h3 className="w-24 shrink-0 text-[14px] font-medium text-text-primary">{label}</h3>
              <Meter share={(covered / terms.length) * 100} className={covered === terms.length ? "bg-green-primary" : undefined} />
              <span className="shrink-0 text-[13px] tabular-nums text-text-tertiary">
                <span className="font-medium text-text-primary">
                  {covered} of {terms.length}
                </span>
                {after && was !== covered && ` · was ${was}`}
              </span>
            </header>
            <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {terms.map(({ term, status }) => (
                <li key={term} className="flex items-center justify-between gap-3 border-b border-stroke-secondary py-2" title={STATUS[status].title}>
                  <span className={cn("min-w-0 truncate text-[13.5px]", status === "missing" ? "text-text-secondary" : "text-text-primary")}>{term}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-text-tertiary">
                    <span aria-hidden className={cn("size-1.5 rounded-full", STATUS[status].dot)} />
                    {STATUS[status].label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
