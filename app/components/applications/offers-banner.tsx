import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { BrandWord } from "~/components/shell/brand-word";
import { StatusBadge } from "~/components/ui/status-badge";
import { cn } from "~/lib/cn";

type OfferRow = { id: string; company: string; role: string; status: string; salary?: string | null; location?: string | null };

function headline(offers: OfferRow[]) {
  const hired = offers.find((o) => o.status === "accepted");
  if (hired) return `You accepted the offer from ${hired.company}. Congratulations.`;
  return offers.length === 1 ? `${offers[0].company} made you an offer. Nice work.` : `You have ${offers.length} offers to weigh up. Nice work.`;
}

export function OffersBanner({ offers }: { offers: OfferRow[] }) {
  if (offers.length === 0) return null;
  const hired = offers.some((o) => o.status === "accepted");

  return (
    <section aria-label="Offers" className="border border-stroke-secondary font-sans text-[14px] normal-case tracking-normal">
      <header className="px-5 pb-4 pt-5">
        <BrandWord word={hired ? "hired" : "offer"} size={30} />
        <p className="mt-2 text-[13.5px] text-text-secondary">{headline(offers)}</p>
      </header>
      <ul className={cn("flex flex-col border-t border-stroke-secondary", INSET_SEPARATORS)}>
        {offers.map((offer) => (
          <li key={offer.id}>
            <Link to={`/applications/${offer.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.04]">
              <CompanyLogo company={offer.company} className="size-9 text-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-text-primary">{offer.company}</p>
                <p className="truncate text-[12.5px] text-text-tertiary">{[offer.role, offer.salary, offer.location].filter(Boolean).join(" · ")}</p>
              </div>
              <StatusBadge status={offer.status} variant="dot" className="shrink-0 text-[12.5px]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
