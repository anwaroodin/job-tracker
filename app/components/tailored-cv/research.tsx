import { fmtDate } from "~/components/ui/terminal";
import type { CompanyResearch } from "~/types/cv";

function Points({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] tracking-[0.12em] text-text-secondary">{title}</span>
      <ul className="flex flex-col gap-1 font-sans text-[13px] normal-case tracking-normal text-text-primary">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className="text-text-tertiary">—</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResearchView({ research }: { research: CompanyResearch }) {
  return (
    <div className="flex flex-col gap-5">
      {research.summary && <p className="font-sans text-[13px] normal-case tracking-normal text-text-secondary">{research.summary}</p>}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Points title="Values" items={research.values} />
        <Points title="What they look for" items={research.lookingFor} />
        <Points title="Culture" items={research.culture} />
        <Points title="Recent news" items={research.news} />
      </div>
      {research.sources.length > 0 && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 font-sans text-[12px] normal-case tracking-normal text-text-tertiary">
          <span>Sources ({fmtDate(research.researchedAt)}):</span>
          {research.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:text-accent-secondary">
              {s.title || new URL(s.url).hostname} ↗
            </a>
          ))}
        </p>
      )}
    </div>
  );
}
