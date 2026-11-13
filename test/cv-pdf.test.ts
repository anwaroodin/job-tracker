import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";
import { atsKey, atsReport, parseSavedAts, pdfRuns } from "~/lib/ats";
import { cvPdf } from "~/lib/cv-pdf";
import { CV_DESIGNS, type CvDesign, type PdfCv } from "~/types/cv";

const fromDisk = async (url: string) => {
  const buffer = await readFile(join(process.cwd(), url.split("?")[0]));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

const job = (n: number, bullet: string) => ({
  title: `Engineer ${n}`,
  company: `Company ${n}`,
  location: "London",
  url: "",
  start: "2020",
  end: null,
  bullets: [bullet, `Shipped feature ${n}`],
  bold: [["Shipped"], []],
});

const cv = (bullet: string, jobs: number, design: CvDesign = "classic"): PdfCv => ({
  design,
  author: { name: "Ada Lovelace", phone: "", location: "London", email: "ada@example.com", linkedin: "", github: "github.com/ada", website: "" },
  summary: "Builds {date} things with (care) and *stars*.",
  summaryBold: ["things"],
  experience: Array.from({ length: jobs }, (_, i) => job(i + 1, bullet)),
  projects: [],
  education: [{ institution: "Cambridge", qualification: "BA Maths", location: "", start: "2016", end: "2019", details: [] }],
  skills: [{ label: "Languages", items: ["TypeScript", "Go"] }],
});

async function read(bytes: Uint8Array) {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(doc, { mergePages: true });
  const links = (await (await doc.getPage(1)).getAnnotations()).map((a: { url?: string }) => a.url).filter(Boolean);
  return { pages: doc.numPages, text: text.replace(/\s+/g, " "), links };
}

describe("cvPdf", () => {
  it("keeps the text literal and in order, with links", async () => {
    const { pages, text, links } = await read(await cvPdf(cv("Short bullet", 2), fromDisk));
    expect(pages).toBe(1);
    expect(text).toContain("Builds {date} things with (care) and *stars*.");
    expect(text.indexOf("Company 1")).toBeLessThan(text.indexOf("Company 2"));
    expect(text.indexOf("Company 2")).toBeLessThan(text.indexOf("Cambridge"));
    expect(links).toEqual(expect.arrayContaining(["mailto:ada@example.com", "https://github.com/ada"]));
  });

  it.each(CV_DESIGNS.map((d) => d.value))("passes every ATS check in the %s design, with a long first bullet under the dates", async (design) => {
    const long = "Migrated the billing platform to TypeScript and PostgreSQL, cutting infrastructure costs by 40% across regions. ".repeat(2).trim();
    const data = cv(long, 2, design);
    expect(atsReport(data, await pdfRuns(await cvPdf(data, fromDisk))).filter((check) => !check.pass)).toEqual([]);
  });

  it("saves ATS results only in a valid shape", async () => {
    const key = await atsKey(cv("Short bullet", 1));
    const saved = { version: 1, key, checks: [{ label: "Name", why: "Parsers", pass: true, detail: "ok", missing: ["x"] }] };
    expect(parseSavedAts(saved)).toEqual(saved);
    expect(parseSavedAts({ ...saved, key: "nope" })).toBeNull();
    expect(parseSavedAts({ ...saved, checks: [{ label: "Name", pass: "yes" }] })).toBeNull();
  });

  it("grows wrapped bullets and breaks onto new pages", async () => {
    const long = "Led a long piece of work that needs several lines to describe properly. ".repeat(8);
    const short = await read(await cvPdf(cv("Short bullet", 12), fromDisk));
    const wrapped = await read(await cvPdf(cv(long, 12), fromDisk));
    expect(wrapped.pages).toBeGreaterThan(short.pages);
    expect(wrapped.text).toContain("Shipped feature 12");
    expect(wrapped.text.indexOf("Company 12")).toBeLessThan(wrapped.text.indexOf("Cambridge"));
  });
});
