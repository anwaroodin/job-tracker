import { useState } from "react";
import { Button } from "~/components/ui/button";
import { authClient } from "~/lib/auth-client";
import { GMAIL_SCOPE } from "~/lib/gmail";
import { syncedAgo } from "~/lib/gmail-status";
import type { GmailStatus } from "~/types/gmail";

export function gmailStatusText(g: GmailStatus) {
  if (!g.connected) return "Auto-match emails to job applications (read-only access)";
  if (g.lastError) return g.lastError;
  const ago = syncedAgo(g);
  return ago ? `Connected · synced ${ago}` : "Connected · first sync pending";
}

export function GmailConnectButton({
  connected,
  broken,
  callbackURL = "/profile#integrations",
  className,
}: {
  connected: boolean;
  broken: boolean;
  callbackURL?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  if (connected && !broken) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
        <span aria-hidden className="size-1.5 rounded-full bg-green-primary" />
        Connected
      </span>
    );
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="small"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
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
