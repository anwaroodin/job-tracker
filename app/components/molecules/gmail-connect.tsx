import { useState } from "react";
import { Button } from "~/components/atoms/button";
import { authClient } from "~/lib/auth-client";
import { GMAIL_SCOPE } from "~/lib/gmail";
import type { GmailStatus } from "~/server/gmail/sync.server";

export function gmailStatusText(g: GmailStatus) {
  if (!g.connected) return "Auto-match emails to job applications (read-only access)";
  if (g.lastError) return g.lastError;
  return g.lastSynced ? `Connected · synced ${g.lastSynced}` : "Connected · first sync pending";
}

export function GmailConnectButton({
  connected,
  broken,
  callbackURL = "/profile#integrations",
}: {
  connected: boolean;
  broken: boolean;
  callbackURL?: string;
}) {
  const [pending, setPending] = useState(false);
  if (connected && !broken) {
    return <span className="text-[11px] tracking-[0.08em] text-green-primary">Connected</span>;
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // google only hands out a refresh token when the consent screen is shown
        const { error } = await authClient.linkSocial({
          provider: "google",
          scopes: [GMAIL_SCOPE],
          callbackURL,
          additionalParams: { prompt: "consent" },
        });
        if (error) setPending(false);
      }}
    >
      {pending ? "Redirecting…" : connected ? "Reconnect" : "Connect"}
    </Button>
  );
}
