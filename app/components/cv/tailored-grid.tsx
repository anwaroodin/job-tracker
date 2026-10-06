import { Link } from "react-router";
import { typstCv } from "~/lib/cv";
import { fmtDate } from "~/components/ui/terminal";
import type { Person, TailoredCvCard } from "~/types/cv";
import { TypstPreview } from "./typst-preview";

const THUMB_WIDTH = 180;

function byRole(cards: TailoredCvCard[]) {
  const groups = new Map<string, { role: string; cards: TailoredCvCard[] }>();
  for (const card of cards) {
    const key = card.role.trim().toLowerCase();
    const group = groups.get(key) ?? { role: card.role.trim(), cards: [] };
    group.cards.push(card);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.cards.length - a.cards.length || a.role.localeCompare(b.role));
}

export function TailoredCvGrid({ person, template, cards }: { person: Person; template: string; cards: TailoredCvCard[] }) {
  if (!cards.length) {
    return (
      <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
        None yet. Open an application and press Tailor in its Details to make one.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {byRole(cards).map((group) => (
        <div key={group.role} className="flex flex-col gap-3">
          <p className="flex items-baseline justify-between gap-4 text-[11px] tracking-[0.12em]">
            <span className="text-text-secondary">{group.role}</span>
            <span className="text-text-tertiary">{group.cards.length}</span>
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,180px)] gap-4">
            {group.cards.map((card) => (
              <li key={card.applicationId}>
                <Link to={`/applications/${card.applicationId}/cv`} className="group flex flex-col gap-2">
                  <div className="transition-opacity group-hover:opacity-80">
                    <TypstPreview template={template} cv={typstCv(person, card.cv)} width={THUMB_WIDTH} expandable={false} />
                  </div>
                  <span className="truncate text-text-primary group-hover:text-accent-primary">{card.company}</span>
                  <span className="text-[10.5px] text-text-tertiary">
                    v{card.version} · {fmtDate(card.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
