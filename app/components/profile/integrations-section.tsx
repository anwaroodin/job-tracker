import type { GmailStatus } from "~/types/gmail";
import { Section } from "~/components/ui/terminal";
import { GmailConnectButton, gmailStatusText } from "~/components/gmail/gmail-connect";

export function IntegrationsSection({ n, gmail }: { n: string; gmail: GmailStatus }) {
  return (
    <Section
      n={n}
      id="integrations"
      title="Integrations"
      hint="Third-party services connected to your account."
      i={7}
    >
      <div className="flex items-center justify-between gap-4 border border-stroke-secondary bg-bg-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center bg-bg-primary text-[12px] font-semibold text-text-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]">
            G
          </div>
          <div>
            <p className="text-text-primary">Gmail</p>
            <p className="mt-0.5 font-sans text-[11.5px] normal-case tracking-normal text-text-secondary">
              {gmailStatusText(gmail)}
            </p>
          </div>
        </div>
        <GmailConnectButton
          connected={gmail.connected}
          broken={!!gmail.lastError}
        />
      </div>
    </Section>
  );
}
