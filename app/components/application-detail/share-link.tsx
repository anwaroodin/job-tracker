import { Copy01Icon, Link01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button, type ButtonProps } from "~/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { DEFAULT_SHARE_DAYS, SHARE_DAYS, type ShareLinkState } from "~/lib/share";

export interface ShareProps {
  applicationId: string;
  link: ShareLinkState | null;
  hasTailoredCv: boolean;
}

export function ShareLink({ applicationId, link, hasTailoredCv, variant = "ghost", size = "tiny" }: ShareProps & Pick<ButtonProps, "variant" | "size">) {
  const fetcher = useFetcher<{ url?: string; ok?: boolean }>();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [days, setDays] = useState<number>(DEFAULT_SHARE_DAYS);
  const [includeCv, setIncludeCv] = useState(hasTailoredCv);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.url) setUrl(fetcher.data.url);
  }, [fetcher.data]);

  const submit = (fields: Record<string, string>) => fetcher.submit(fields, { method: "post", action: `/applications/${applicationId}/share` });
  const create = () => submit({ intent: "create", days: String(days), includeCv: String(hasTailoredCv && includeCv) });
  const copy = () => {
    if (url) navigator.clipboard.writeText(url).then(() => setCopied(true), () => {});
  };
  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setUrl(null);
      setCopied(false);
    }
  };

  const label = "text-[12.5px] text-text-tertiary";
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={Link01Icon} size={15} strokeWidth={1.5} />
        Share{link && " · on"}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              Anyone with the link can view the job description{hasTailoredCv && " and, if you include it, your latest tailored CV"}. Your notes, emails and status stay private.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
          {url ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-9 text-[13.5px]" />
                <Button type="button" variant="secondary" className="px-3" onClick={copy}>
                  <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={15} strokeWidth={1.5} />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[12.5px] text-text-tertiary">Copy it now: it's only shown once. You can make a new one later, which turns this one off.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {link && (
                <p className="text-[13.5px] text-text-secondary">
                  A link is on until {shortDate(link.expiresAt)}
                  {hasTailoredCv && (link.includeCv ? ", with your tailored CV" : ", without your CV")}.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <span className={label}>{link ? "Change expiry to" : "Expires in"}</span>
                <div className="flex gap-1">
                  {SHARE_DAYS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant="ghost"
                      aria-pressed={!link && days === d}
                      className={cn(
                        "h-8 px-3 text-[13px]",
                        !link && days === d ? "bg-ink/[0.07] text-text-primary hover:bg-ink/[0.07]" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
                      )}
                      disabled={busy}
                      onClick={() => (link ? submit({ intent: "update", days: String(d) }) : setDays(d))}
                    >
                      {d === 1 ? "1 day" : `${d} days`}
                    </Button>
                  ))}
                </div>
              </div>
              {hasTailoredCv && (
                <Switch
                  label="Include tailored CV"
                  checked={link ? link.includeCv : includeCv}
                  onCheckedChange={(v) => (link ? submit({ intent: "update", includeCv: String(v) }) : setIncludeCv(v))}
                />
              )}
            </div>
          )}
          </DialogBody>

          {!url && (
            <DialogFooter>
              {link && (
                <Button type="button" variant="ghost" className="h-9 text-[13.5px] text-red-primary hover:bg-red-quaternary hover:text-red-primary sm:mr-auto" disabled={busy} onClick={() => submit({ intent: "revoke" })}>
                  Turn off
                </Button>
              )}
              <Button type="button" disabled={busy} onClick={create}>
                {busy ? "Working…" : link ? "New link" : "Create link"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
