import { cvPdf } from "~/lib/cv-pdf";
import type { PdfCv } from "~/types/cv";

export function renderCvPdf(env: Env, origin: string, cv: PdfCv) {
  return cvPdf(cv, async (url) => {
    const res = await env.ASSETS.fetch(new URL(url, origin));
    if (!res.ok) throw new Error(`Couldn't load a CV font (${res.status})`);
    return res.arrayBuffer();
  });
}
