import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { SideBlock } from "~/components/ui/side-block";
import { ATS_VERSION, atsKey, atsReport, pdfRuns, type SavedAts } from "~/lib/ats";
import type { PdfCv } from "~/types/cv";
import { pdfBlob } from "./cv-preview";

const current = (saved: SavedAts | null) => (saved?.version === ATS_VERSION ? saved : null);

function useCachedAts(cv: PdfCv, saved: SavedAts | null) {
  const fetcher = useFetcher();
  const [result, setResult] = useState<SavedAts | null>(() => current(saved));
  const [error, setError] = useState(false);
  const data = JSON.stringify(cv);

  useEffect(() => {
    let live = true;
    (async () => {
      const key = await atsKey(cv);
      const cached = current(saved);
      if (cached?.key === key) {
        if (live) setResult(cached);
        return;
      }
      if (live) setResult(null);
      const checks = atsReport(cv, await pdfRuns(await (await pdfBlob(cv)).arrayBuffer()));
      if (!live) return;
      const fresh = { version: ATS_VERSION, key, checks };
      setResult(fresh);
      setError(false);
      fetcher.submit({ intent: "save-ats", ats: JSON.stringify(fresh) }, { method: "post" });
    })().catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [data, saved?.key, saved?.version]);

  return { checks: result?.checks ?? null, error };
}

export function AtsChecks({ cv, saved, stale = false }: { cv: PdfCv; saved: SavedAts | null; stale?: boolean }) {
  const { checks, error } = useCachedAts(cv, saved);
  const passed = checks?.filter((c) => c.pass).length ?? 0;

  return (
    <SideBlock title="ATS checks" aside={checks && `${passed}/${checks.length} passed${stale ? " · saved CV" : ""}`}>
      {error && <p className="text-[13px] text-red-primary">Couldn't read the PDF back to check it.</p>}
      {!checks && !error && <p className="text-[13px] text-text-tertiary">Checking…</p>}
      {checks && (
        <ul className="flex flex-col gap-2.5">
          {checks.map((check) => (
            <li key={check.label} className="flex flex-col gap-1" title={check.why}>
              <div className="flex items-center gap-2.5 text-[13.5px]">
                <span className={`size-1.5 shrink-0 rounded-full ${check.pass ? "bg-green-primary" : "bg-red-primary"}`} />
                <span className="min-w-0 flex-1 truncate text-text-secondary">{check.label}</span>
                <span className={`text-[12.5px] ${check.pass ? "text-green-primary" : "text-red-primary"}`}>{check.pass ? "Pass" : "Fail"}</span>
              </div>
              {!check.pass && (
                <div className="pl-4 text-[12.5px] text-text-tertiary">
                  <p>{check.detail}</p>
                  {!!check.missing?.length && (
                    <ul className="mt-1 flex flex-col gap-1">
                      {check.missing.map((m) => (
                        <li key={m} className="line-clamp-2 text-text-secondary">
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SideBlock>
  );
}
