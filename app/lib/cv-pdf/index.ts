import { generate } from "@pdfme/generator";
import { decodePDFRawStream, parseFont, PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef } from "@pdfme/pdf-lib";
import * as fontkit from "fontkit";
import type { Font, Schema, Template } from "@pdfme/common";
import { rectangle, svg, text } from "@pdfme/schemas";
import { measureTextHeight } from "@pdfme/schemas/utils";
import { cvDesign, type PdfCv } from "~/types/cv";
import { DESIGNS, designFonts, type Design } from "./designs";
import { loadFonts, type FontLoader } from "./fonts";
import { cvTemplate, type TextWidth } from "./layout";

export type { FontLoader } from "./fonts";

const restyleUnderlines = (ops: string, underline: Design["underline"]) =>
  underline
    ? ops.replace(/[\d.]+ [\d.]+ [\d.]+ RG\n([\d.]+) w\n/g, (_, w) => `${underline.grey} ${underline.grey} ${underline.grey} RG\n${underline.width ?? w} w\n`)
    : ops.replace(/[\d.]+ [\d.]+ [\d.]+ RG\n[\d.]+ w\n(?:[^\n]*\n)*?S\n/g, "");

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

async function tidyOperators(pdf: Uint8Array, underline: Design["underline"]) {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  for (const page of doc.getPages()) {
    const contents = page.node.get(PDFName.of("Contents"));
    for (const ref of contents instanceof PDFArray ? contents.asArray() : [contents]) {
      const stream = doc.context.lookup(ref);
      if (!(ref instanceof PDFRef) || !(stream instanceof PDFRawStream)) continue;
      const ops = restyleUnderlines(latin1(decodePDFRawStream(stream).decode()).replace(/T\*\s+ET/g, "ET"), underline);
      doc.context.assign(ref, doc.context.flateStream(Uint8Array.from(ops, (c) => c.charCodeAt(0))));
    }
  }
  return doc.save({ updateFieldAppearances: false });
}

const SORT_LAST_MM = 0.02;

type TextSchema = Parameters<typeof measureTextHeight>[0]["schema"];

async function growTallestOnly(template: Template, font: Font) {
  const rows = new Map<number, Schema[]>();
  for (const s of template.schemas[0]) if (s.type === "text") rows.set(s.position.y, [...(rows.get(s.position.y) ?? []), s]);
  const cache = new Map();
  for (const row of rows.values()) {
    if (row.length < 2) continue;
    const heights = await Promise.all(row.map((s) => measureTextHeight({ value: String(s.content ?? ""), schema: s as TextSchema, font, _cache: cache })));
    const tallest = heights.indexOf(Math.max(...heights));
    row.forEach((s, i) => (i === tallest ? (s.position.y += SORT_LAST_MM) : Object.assign(s, { overflow: "visible", height: heights[i] })));
  }
  return template;
}

function widths(font: Font): TextWidth {
  const faces = new Map(Object.entries(font).map(([name, { data }]) => [name, parseFont(fontkit as unknown as Parameters<typeof parseFont>[0], new Uint8Array(data as ArrayBuffer))]));
  return (text, pt, name) => {
    const face = faces.get(name)!;
    return (face.layout(text).glyphs.reduce((sum, glyph) => sum + glyph.advanceWidth, 0) / face.unitsPerEm) * pt;
  };
}

export async function cvPdf(cv: PdfCv, load: FontLoader) {
  const design = DESIGNS[cvDesign(cv.design)];
  const font = await loadFonts(designFonts(design), load);
  const pdf = await generate({
    template: await growTallestOnly(cvTemplate(cv, design, widths(font)), font),
    inputs: [{}],
    plugins: { text, rectangle, svg },
    options: { font, author: cv.author.name, creator: cv.author.name, title: cv.author.name ? `${cv.author.name} CV` : "CV", lang: "en" },
  });
  return tidyOperators(pdf, design.underline);
}
