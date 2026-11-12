import { ChromeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import type { GmailStatus } from "~/types/gmail";
import { Button } from "~/components/ui/button";
import { PageSection } from "~/components/ui/page-section";
import { fmtDate } from "~/components/ui/terminal";
import { GmailConnectButton, gmailStatusText } from "~/components/gmail/gmail-connect";
import gmailIcon from "~/assets/gmail.png";

export function IntegrationsSection({ gmail, extensionUpdatedAt }: { gmail: GmailStatus; extensionUpdatedAt: string | null }) {
  return (
    <PageSection
      id="integrations"
      title="Integrations"
      description="Services and tools connected to your account."
    >
      <div className="flex flex-col gap-3">
        <Integration
          logo={<img src={gmailIcon} alt="Gmail" className="size-full object-contain" />}
          name="Gmail"
          status={gmailStatusText(gmail)}
          action={<GmailConnectButton connected={gmail.connected} broken={!!gmail.lastError} />}
        />
        <Integration
          logo={<HugeiconsIcon icon={ChromeIcon} size={20} className="text-text-primary" />}
          name="Chrome extension"
          status={extensionUpdatedAt ? `Updated ${fmtDate(extensionUpdatedAt)}. Download it and follow the setup steps.` : "No build published yet."}
          action={
            <Button asChild size="small" data-tour="extension-setup">
              <Link to="/extension">Set up</Link>
            </Button>
          }
        />
      </div>
    </PageSection>
  );
}

function Integration({ logo, name, status, action }: { logo: React.ReactNode; name: string; status: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-stroke-secondary px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden bg-fill-secondary p-1">{logo}</span>
        <div>
          <p className="font-medium text-text-primary">{name}</p>
          <p className="text-[13px] text-text-tertiary">{status}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
