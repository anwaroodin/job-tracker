import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import type { Cv, CvImportResult } from "~/types/cv";

export function CvImport({ onImported }: { onImported: (cv: Cv) => void }) {
  const fetcher = useFetcher<{ imported?: CvImportResult }>();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = fetcher.state !== "idle";
  const result = fetcher.data?.imported;

  useEffect(() => {
    if (!result || !("cv" in result)) return;
    onImported(result.cv);
    setPasting(false);
    setText("");
  }, [result]);

  const submit = (data: Record<string, string | File>) => {
    const form = new FormData();
    form.set("intent", "import-cv");
    for (const [key, value] of Object.entries(data)) form.set(key, value);
    fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
  };

  const uploadPdf = (file: File | undefined) => {
    if (file) submit({ file });
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => uploadPdf(e.target.files?.[0])}
        />
        <Button type="button" variant="secondary" size="small" className="uppercase" disabled={busy} onClick={() => fileInput.current?.click()}>
          Upload PDF
        </Button>
        <Button type="button" variant="ghost" size="small" className="uppercase" disabled={busy} onClick={() => setPasting((p) => !p)}>
          Paste text
        </Button>
        <span className="text-[11px] tracking-[0.08em] text-text-tertiary">
          {busy ? "Reading your CV…" : "Fills the fields below from your existing CV, in your own words."}
        </span>
      </div>

      {pasting && (
        <div className="flex flex-col gap-2">
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your CV's text here…" autoFocus />
          <div className="flex gap-2">
            <Button type="button" size="small" className="uppercase" disabled={busy || !text.trim()} onClick={() => submit({ text })}>
              Import
            </Button>
            <Button type="button" variant="ghost" size="small" className="uppercase" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && "error" in result && <p className="normal-case tracking-normal text-red-primary">{result.error}</p>}
      {result && "cv" in result && !busy && (
        <p className="normal-case tracking-normal text-green-primary">
          Read {result.lines} lines. Check everything below, then save.
        </p>
      )}
    </div>
  );
}
