import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { renderPdf, renderSvg } from "~/lib/typst";
import type { TypstCv } from "~/types/cv";

const LETTER_RATIO = 8.5 / 11;
const RENDER_DELAY_MS = 300;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function usePageUrls(pages: string[]) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = pages.map((page) => URL.createObjectURL(new Blob([page], { type: "image/svg+xml" })));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [pages]);
  return urls;
}

export function TypstPreview({ template, cv, width, expandable = true }: { template: string; cv: TypstCv; width?: number; expandable?: boolean }) {
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const urls = usePageUrls(pages);

  const data = JSON.stringify(cv);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const out = await renderSvg(template, cv);
        if (!current) return;
        setPages(out);
        setError(null);
      } catch (e) {
        if (current) setError(message(e));
      }
    }, RENDER_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [template, data]);

  const shown = width ? urls.slice(0, 1) : urls;
  const sheets = (
    <div className="flex flex-col gap-3">
      {shown.map((url, i) => (
        <img key={url} src={url} alt={`Page ${i + 1}`} className="block w-full border border-stroke-secondary bg-paper" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2" style={width ? { width } : undefined}>
      {!urls.length ? (
        <div className="animate-pulse border border-stroke-secondary bg-paper" style={{ aspectRatio: LETTER_RATIO }} />
      ) : expandable ? (
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="cursor-zoom-in text-left" aria-label="Open a larger preview">
              {sheets}
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-bg-secondary p-6">
            <DialogTitle className="sr-only">CV preview</DialogTitle>
            <div className="flex flex-col gap-4">
              {urls.map((url, i) => (
                <img key={url} src={url} alt={`Page ${i + 1}`} className="block w-full bg-paper" />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        sheets
      )}
      {error && <pre className="whitespace-pre-wrap font-mono text-[11px] normal-case tracking-normal text-red-primary">{error}</pre>}
    </div>
  );
}

export function PdfButton({ template, cv, filename }: { template: string; cv: TypstCv; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = URL.createObjectURL(await renderPdf(template, cv));
      const link = Object.assign(document.createElement("a"), { href: url, download: filename });
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="small" className="uppercase" disabled={busy} onClick={download}>
        <Download />
        {busy ? "Making PDF…" : "Download PDF"}
      </Button>
      {error && <span className="normal-case tracking-normal text-red-primary">{error}</span>}
    </div>
  );
}
