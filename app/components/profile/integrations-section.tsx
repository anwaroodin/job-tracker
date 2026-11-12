import type { GmailStatus } from "~/types/gmail";
import { PageSection } from "~/components/ui/page-section";
import { GmailConnectButton, gmailStatusText } from "~/components/gmail/gmail-connect";
import gmailIcon from "~/assets/gmail.png";

export function IntegrationsSection({ gmail }: { gmail: GmailStatus }) {
  return (
    <PageSection
      id="integrations"
      title="Integrations"
      description="Third-party services connected to your account."
    >
      <div className="flex items-center justify-between gap-4 border border-stroke-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden bg-fill-secondary p-1">
            <img src={gmailIcon} alt="Gmail" className="size-full object-contain" />
          </span>
          <div>
            <p className="font-medium text-text-primary">Gmail</p>
            <p className="text-[13px] text-text-tertiary">
              {gmailStatusText(gmail)}
            </p>
          </div>
        </div>
        <GmailConnectButton
          connected={gmail.connected}
          broken={!!gmail.lastError}
        />
      </div>
    </PageSection>
  );
}
