import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { shortDate } from "~/components/ui/terminal";
import { hostOf } from "~/lib/format/url";
import type { CompanyResearch, ResearchPoint } from "~/types/cv";

function Group({ title, items }: { title: string; items: (ResearchPoint & { date?: string })[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[12.5px] font-medium text-text-tertiary">{title}</h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.title} className="flex flex-col gap-0.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-text-primary">{item.title}</span>
              {item.date && <span className="shrink-0 text-[12.5px] tabular-nums text-text-tertiary">{item.date}</span>}
            </span>
            {item.detail && <span className="text-[13.5px] leading-relaxed text-text-secondary">{item.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResearchView({ research }: { research: CompanyResearch }) {
  const groups = [
    { title: "What they look for", items: research.lookingFor },
    { title: "Values", items: research.values },
    { title: "Culture", items: research.culture },
    { title: "Recent news", items: research.news },
  ].filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-8">
      {(research.summary || research.facts.length > 0) && (
        <div className="flex flex-col gap-4">
          {research.summary && <p className="max-w-prose text-[14.5px] leading-relaxed text-text-secondary">{research.summary}</p>}
          {research.facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {research.facts.map((f) => (
                <div key={f.label} className="flex flex-col gap-0.5">
                  <dt className="text-[12.5px] text-text-tertiary">{f.label}</dt>
                  <dd className="font-medium text-text-primary">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      {groups.length > 0 && (
        <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {groups.map((g) => (
            <Group key={g.title} title={g.title} items={g.items} />
          ))}
        </div>
      )}
      {research.sources.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stroke-secondary pt-4 text-[12.5px] text-text-tertiary">
          <span>Sources · {shortDate(research.researchedAt)}</span>
          {research.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              {s.title || hostOf(s.url)}
              <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
            </a>
          ))}
        </p>
      )}
    </div>
  );
}
