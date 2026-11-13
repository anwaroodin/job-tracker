import { Cancel01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useState, type MouseEvent } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import type { FontLoader } from "~/lib/cv-pdf";
import { pdfPageImages } from "~/lib/pdf-pages";
import type { PdfCv } from "~/types/cv";

const LETTER_RATIO = 8.5 / 11;
const RENDER_DELAY_MS = 300;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const browserFonts: FontLoader = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load a CV font (${res.status})`);
  return res.arrayBuffer();
};

export async function pdfBlob(cv: PdfCv) {
  const { cvPdf } = await import("~/lib/cv-pdf");
  return new Blob([new Uint8Array(await cvPdf(cv, browserFonts))], { type: "application/pdf" });
}

function usePdfPages(cv: PdfCv) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = JSON.stringify(cv);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const images = await pdfPageImages(await (await pdfBlob(cv)).arrayBuffer());
        if (!current) return;
        setPages(images);
        setError(null);
      } catch (e) {
        if (current) setError(message(e));
      }
    }, RENDER_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [data]);

  return { pages, error };
}

const FLOATING = "border border-stroke-primary shadow-[0_24px_64px_rgba(0,0,0,0.22)]";
const SANS_BUTTON = "h-9 px-3.5 font-sans text-[13.5px] normal-case tracking-normal";

function useDownload(cv: PdfCv, filename: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = URL.createObjectURL(await pdfBlob(cv));
      Object.assign(document.createElement("a"), { href: url, download: filename }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, download };
}

const DownloadLabel = ({ busy }: { busy: boolean }) => (
  <>
    <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.5} />
    {busy ? "Making PDF…" : "Download PDF"}
  </>
);

const Sheet = ({ src, alt, className = "" }: { src: string; alt: string; className?: string }) => (
  <img src={src} alt={alt} className={`block w-full bg-paper ${className}`} />
);

function Viewer({ cv, pages, filename, onClose }: { cv: PdfCv; pages: string[]; filename: string; onClose: () => void }) {
  const { busy, error, download } = useDownload(cv, filename);
  const closeOnBackdrop = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-keep-open]")) onClose();
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        onClick={closeOnBackdrop}
        className="no-scrollbar fixed inset-0 z-50 overflow-y-auto px-4 pb-24 font-sans text-[14px] normal-case tracking-normal outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 sm:px-8"
      >
        <DialogTitle className="sr-only">{cv.author.name ? `${cv.author.name}'s CV` : "Your CV"}</DialogTitle>
        <div className="mx-auto mt-8 flex max-w-[816px] flex-col gap-6">
          {pages.map((src, i) => (
            <div key={i} data-keep-open className={FLOATING}>
              <Sheet src={src} alt={`CV page ${i + 1} of ${pages.length}`} />
            </div>
          ))}
        </div>
        <div data-keep-open className="fixed bottom-6 right-6 z-10 flex flex-col items-end gap-2">
          {error && <p className={`max-w-72 bg-sidebar-active px-3 py-2 text-[12.5px] text-red-primary ${FLOATING}`}>{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="button" className={`${SANS_BUTTON} ${FLOATING}`} disabled={busy} onClick={download}>
              <DownloadLabel busy={busy} />
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="icon" className={`size-9 bg-sidebar-active text-text-primary hover:bg-sidebar-active ${FLOATING}`} aria-label="Close preview">
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function CvPreview({ cv, width, expandable = true, filename }: { cv: PdfCv; width?: number; expandable?: boolean; filename?: string }) {
  const { pages, error } = usePdfPages(cv);
  const [open, setOpen] = useState(false);
  const first = pages?.[0];
  const thumbnail = first && <Sheet src={first} alt="CV preview, page 1" className="border border-stroke-secondary" />;

  return (
    <div className="flex flex-col gap-2" style={width ? { width } : undefined}>
      {!first ? (
        <div className="animate-pulse border border-stroke-secondary bg-paper" style={{ aspectRatio: LETTER_RATIO }} />
      ) : expandable ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Open a larger preview"
              className="block cursor-zoom-in text-left transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-text-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
            >
              {thumbnail}
            </button>
          </DialogTrigger>
          <Viewer cv={cv} pages={pages} filename={filename ?? `${cv.author.name || "CV"} - CV.pdf`} onClose={() => setOpen(false)} />
        </Dialog>
      ) : (
        thumbnail
      )}
      {pages && pages.length > 1 && <p className="text-[12.5px] text-text-tertiary">Page 1 of {pages.length}</p>}
      {error && <pre className="whitespace-pre-wrap font-mono text-[11px] normal-case tracking-normal text-red-primary">{error}</pre>}
    </div>
  );
}

export function PdfButton({ cv, filename }: { cv: PdfCv; filename: string }) {
  const { busy, error, download } = useDownload(cv, filename);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="small" className="font-sans normal-case tracking-normal" disabled={busy} onClick={download}>
        <DownloadLabel busy={busy} />
      </Button>
      {error && <span className="normal-case tracking-normal text-red-primary">{error}</span>}
    </div>
  );
}
