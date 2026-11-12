import { Link } from "react-router";
import { ShareLink } from "~/components/application-detail/share-link";
import { shortDate } from "~/components/ui/terminal";
import type { ShareLinkState } from "~/lib/share";

export interface SharedLinkRow extends ShareLinkState {
  applicationId: string;
  company: string;
  role: string;
  hasTailoredCv: boolean;
}

export function SharedLinks({ links }: { links: SharedLinkRow[] }) {
  if (!links.length) {
    return <p className="text-[13.5px] text-text-tertiary">Nothing is shared. Share an application from its page.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-stroke-secondary">
      {links.map(({ applicationId, company, role, includeCv, expiresAt, hasTailoredCv }) => (
        <li key={applicationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <Link to={`/applications/${applicationId}`} className="font-medium text-text-primary hover:underline">
              {company}
            </Link>
            <span className="ml-2 text-text-tertiary">{role}</span>
            <p className="mt-0.5 text-[13px] text-text-tertiary">
              Until {shortDate(expiresAt)} · {includeCv && hasTailoredCv ? "Job + CV" : "Job only"}
            </p>
          </div>
          <ShareLink applicationId={applicationId} link={{ includeCv, expiresAt }} hasTailoredCv={hasTailoredCv} variant="secondary" />
        </li>
      ))}
    </ul>
  );
}
