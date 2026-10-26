import { Check, Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button, type ButtonProps } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { fmtDate } from "~/components/ui/terminal";
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

  const label = "text-[10.5px] tracking-[0.1em] text-text-tertiary";
  return (
    <>
      <Button type="button" variant={variant} size={size} className="uppercase" onClick={() => setOpen(true)}>
        <Link2 />
        Share{link && " · on"}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="w-[calc(100%-2rem)] font-mono uppercase tracking-[0.04em]">
          <DialogHeader>
            <DialogTitle className="font-normal">Share link</DialogTitle>
            <DialogDescription className="font-sans normal-case">
              Anyone with the link can view the job description{hasTailoredCv && " and, if you include it, your latest tailored CV"}. Your notes, emails and status stay private.
            </DialogDescription>
          </DialogHeader>

          {url ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-sans normal-case" />
                <Button type="button" variant="secondary" className="uppercase" onClick={copy}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="font-sans text-[12px] normal-case tracking-normal text-text-tertiary">Copy it now: it's only shown once. You can make a new one later, which turns this one off.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {link && (
                <p className="font-sans text-[13px] normal-case tracking-normal text-text-secondary">
                  A link is on until {fmtDate(link.expiresAt)}
                  {hasTailoredCv && (link.includeCv ? ", with your tailored CV" : ", without your CV")}.
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <span className={label}>{link ? "Change expiry to" : "Expires in"}</span>
                <div className="flex gap-2">
                  {SHARE_DAYS.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="tiny"
                      variant={!link && days === d ? "primary" : "secondary"}
                      className="uppercase"
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

          <DialogFooter className="gap-2">
            {link && !url && (
              <Button type="button" variant="destructive" className="uppercase" disabled={busy} onClick={() => submit({ intent: "revoke" })}>
                Turn off
              </Button>
            )}
            {!url && (
              <Button type="button" className="uppercase" disabled={busy} onClick={create}>
                {busy ? "Working…" : link ? "New link" : "Create link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
