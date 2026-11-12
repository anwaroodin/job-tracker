import { ArrowRight01Icon, BookOpen01Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { ReactNode, RefObject } from "react";
import { CompanyLogo } from "~/components/applications/company-logo";
import { StatusBadge } from "~/components/ui/status-badge";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { SearchApplicationItem, SearchEmailItem } from "~/types/search";
import { NAV_ICONS } from "../nav";
import type { NAV_ITEMS, SelectableItem } from "./items";

function Tile({ icon }: { icon: IconSvgElement }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center bg-ink/[0.05] text-text-secondary">
      <HugeiconsIcon icon={icon} size={17} strokeWidth={1.5} />
    </span>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col pb-2">
      <p className="px-3 pb-1.5 pt-2 text-[12px] font-medium text-text-tertiary">{title}</p>
      {children}
    </div>
  );
}

export function PaletteResults({
  query,
  filteredNav,
  filteredApps,
  filteredEmails,
  allSelectables,
  selectedIndex,
  setSelectedIndex,
  activeItemRef,
  activate,
}: {
  query: string;
  filteredNav: (typeof NAV_ITEMS)[number][];
  filteredApps: SearchApplicationItem[];
  filteredEmails: SearchEmailItem[];
  allSelectables: SelectableItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  activeItemRef: RefObject<HTMLDivElement | null>;
  activate: (item: SelectableItem) => void;
}) {
  const row = (item: SelectableItem, leading: ReactNode, title: ReactNode, subtitle: ReactNode, trailing: ReactNode) => {
    const index = allSelectables.findIndex((s) => s.type === item.type && s.item.id === item.item.id);
    const selected = index === selectedIndex;
    return (
      <div
        key={`${item.type}-${item.item.id}`}
        ref={selected ? activeItemRef : undefined}
        role="option"
        aria-selected={selected}
        onClick={() => activate(item)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2", selected && "bg-ink/[0.06]")}
      >
        {leading}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-text-primary">{title}</p>
          {subtitle && <p className="truncate text-[12.5px] text-text-tertiary">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[12.5px] text-text-tertiary">{trailing}</div>
      </div>
    );
  };

  return (
    <div role="listbox" className="max-h-[400px] overflow-y-auto px-2 py-1">
      {allSelectables.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="font-medium text-text-primary">{query ? `Nothing matches “${query}”` : "Nothing here yet"}</p>
          <p className="mt-1 text-[13px] text-text-tertiary">Try a company name, a role, or switch to All.</p>
        </div>
      ) : (
        <>
          {filteredNav.length > 0 && (
            <Group title="Pages">
              {filteredNav.map((item) =>
                row(
                  { type: "nav", item },
                  <Tile icon={NAV_ICONS[item.to] ?? BookOpen01Icon} />,
                  item.label,
                  item.hint,
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} />,
                ),
              )}
            </Group>
          )}

          {filteredApps.length > 0 && (
            <Group title="Jobs">
              {filteredApps.map((item) =>
                row(
                  { type: "app", item },
                  <CompanyLogo company={item.company} className="size-8 text-[13px]" />,
                  item.company,
                  [item.role, item.location].filter(Boolean).join(" · "),
                  <>
                    <span className="hidden tabular-nums sm:inline">{shortDate(item.appliedAt)}</span>
                    <StatusBadge status={item.status} variant="dot" className="text-[12.5px]" />
                  </>,
                ),
              )}
            </Group>
          )}

          {filteredEmails.length > 0 && (
            <Group title="Emails">
              {filteredEmails.map((item) =>
                row(
                  { type: "email", item },
                  <Tile icon={Mail01Icon} />,
                  item.subject || "(No subject)",
                  [item.company, item.fromAddress].filter(Boolean).join(" · "),
                  <span className="tabular-nums">{shortDate(item.receivedAt)}</span>,
                ),
              )}
            </Group>
          )}
        </>
      )}
    </div>
  );
}
