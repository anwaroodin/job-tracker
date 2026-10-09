import defaultTemplate from "./cv-template.typ?raw";
import type { TypstCv } from "~/types/cv";

export const DEFAULT_CV_TEMPLATE = defaultTemplate;

async function render(template: string, cv: TypstCv, format: "svg" | "pdf") {
  const res = await fetch("/api/cv/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template, cv, format }),
  });
  if (res.headers.get("content-type")?.includes("application/pdf")) return res.blob();
  const body = (await res.json().catch(() => ({}))) as { pages?: string[]; errors?: string[] };
  if (body.errors) throw new Error(body.errors.join("\n"));
  if (!res.ok || !body.pages) throw new Error(`Rendering failed (${res.status})`);
  return body.pages;
}

export const renderSvg = (template: string, cv: TypstCv) => render(template, cv, "svg") as Promise<string[]>;
export const renderPdf = (template: string, cv: TypstCv) => render(template, cv, "pdf") as Promise<Blob>;
