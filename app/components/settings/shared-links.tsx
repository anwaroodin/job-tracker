import { Link } from "react-router";
import { ShareLink } from "~/components/application-detail/share-link";
import { fmtDate } from "~/components/ui/terminal";
import type { ShareLinkState } from "~/lib/share";

export interface SharedLinkRow extends ShareLinkState {
  applicationId: string;
  company: string;
  role: string;
  hasTailoredCv: boolean;
}

export function SharedLinks({ links }: { links: SharedLinkRow[] }) {
  if (!links.length) {
    return <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">Nothing is shared. Share an application from its page.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-dashed divide-white/10">
      {links.map(({ applicationId, company, role, includeCv, expiresAt, hasTailoredCv }) => (
        <li key={applicationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <Link to={`/applications/${applicationId}`} className="text-text-primary transition-colors hover:text-accent-primary">
              {company}
            </Link>
            <span className="ml-2 text-text-tertiary">{role}</span>
            <p className="mt-1 text-[11px] tracking-[0.1em] text-text-tertiary">
              Until {fmtDate(expiresAt)} · {includeCv && hasTailoredCv ? "Job + CV" : "Job only"}
            </p>
          </div>
          <ShareLink applicationId={applicationId} link={{ includeCv, expiresAt }} hasTailoredCv={hasTailoredCv} variant="secondary" />
        </li>
      ))}
    </ul>
  );
}
