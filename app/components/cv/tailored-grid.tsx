import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Input } from "~/components/ui/input";
import { shortDate } from "~/components/ui/terminal";
import { groupByRole } from "~/lib/job-titles";
import type { TailoredCvCard } from "~/types/cv";

const SHOWN_AT_FIRST = 8;

export function TailoredCvList({ cards }: { cards: TailoredCvCard[] }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!cards.length) {
    return <p className="text-[13.5px] text-text-tertiary">None yet. Open an application and press Tailor CV in its Details to make one.</p>;
  }

  const q = query.trim().toLowerCase();
  const matching = q ? cards.filter((c) => `${c.company} ${c.role}`.toLowerCase().includes(q)) : cards;
  const limit = showAll || q ? matching.length : SHOWN_AT_FIRST;
  let left = limit;
  const groups = groupByRole(matching)
    .map((g) => {
      const items = g.items.slice(0, Math.max(0, left));
      left -= items.length;
      return { ...g, items };
    })
    .filter((g) => g.items.length);

  return (
    <div className="flex flex-col gap-3">
      {cards.length > SHOWN_AT_FIRST && (
        <div className="relative sm:w-72">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or role" className="h-9 pl-8 text-[13.5px]" />
        </div>
      )}

      {groups.length === 0 && <p className="py-6 text-center text-[13.5px] text-text-tertiary">Nothing matches “{query}”.</p>}

      {groups.map((group) => (
        <div key={group.role} className="flex flex-col">
          <p className="flex items-baseline justify-between px-3 pb-1.5 pt-2 text-[12px] font-medium text-text-tertiary">
            <span>{group.role}</span>
            <span className="tabular-nums">{group.items.length}</span>
          </p>
          {group.items.map((card) => (
            <Link
              key={card.applicationId}
              to={`/applications/${card.applicationId}/cv`}
              className="flex min-h-12 items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.04]"
            >
              <CompanyLogo company={card.company} className="size-8 text-[13px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-text-primary">{card.company}</span>
                <span className="block truncate text-[12.5px] text-text-tertiary">{card.role}</span>
              </span>
              <span className="shrink-0 text-[12.5px] tabular-nums text-text-tertiary">
                Version {card.version} · {shortDate(card.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      ))}

      {!q && matching.length > SHOWN_AT_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((all) => !all)}
          className="cursor-pointer self-start px-3 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          {showAll ? "Show fewer" : `Show all ${matching.length}`}
        </button>
      )}
    </div>
  );
}
