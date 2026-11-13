import type { PdfCv } from "~/types/cv";

export type TextRun = { str: string; x: number; y: number; width: number; height: number };
type PdfTextItem = { str: string; transform: number[]; width: number; height: number };

export const textRuns = (items: readonly object[]): TextRun[] =>
  items
    .filter((item): item is PdfTextItem => "str" in item)
    .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height || Math.abs(item.transform[3]) }));

export async function pdfRuns(bytes: ArrayBuffer | Uint8Array) {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pages: TextRun[][] = [];
    for (let n = 1; n <= doc.numPages; n++) pages.push(textRuns((await (await doc.getPage(n)).getTextContent()).items));
    return pages;
  } finally {
    await doc.loadingTask.destroy();
  }
}

type Line = { x0: number; x1: number; y: number; height: number; text: string };
export type AtsCheck = { label: string; why: string; pass: boolean; detail: string; missing?: string[] };
export type SavedAts = { version: number; key: string; checks: AtsCheck[] };

export const ATS_VERSION = 4;
const MAX_CHECKS = 20;
const MAX_MISSING = 100;
const MAX_TEXT = 2000;

export async function atsKey(cv: PdfCv) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(cv)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const text = (value: unknown) => (typeof value === "string" ? value.slice(0, MAX_TEXT) : null);

function parseCheck(value: unknown): AtsCheck | null {
  if (!value || typeof value !== "object") return null;
  const { label, why, pass, detail, missing } = value as Record<string, unknown>;
  const fields = { label: text(label), why: text(why), detail: text(detail) };
  if (fields.label === null || fields.why === null || fields.detail === null || typeof pass !== "boolean") return null;
  const list = Array.isArray(missing) ? missing.slice(0, MAX_MISSING).map(text).filter((m): m is string => m !== null) : undefined;
  return { label: fields.label, why: fields.why, detail: fields.detail, pass, missing: list };
}

export function parseSavedAts(value: unknown): SavedAts | null {
  if (!value || typeof value !== "object") return null;
  const { version, key, checks } = value as Record<string, unknown>;
  if (typeof version !== "number" || typeof key !== "string" || !/^[0-9a-f]{64}$/.test(key) || !Array.isArray(checks)) return null;
  const parsed = checks.slice(0, MAX_CHECKS).map(parseCheck);
  return parsed.every((c): c is AtsCheck => c !== null) ? { version, key, checks: parsed } : null;
}

const SAME_LINE = 0.5;
const WORD_GAP = 0.25;
const COLUMN_GAP = 1;
const BLOCK_PITCH = 1.5;
const BLOCK_ALIGN = 0.5;

const norm = (value: string) =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/\s*[–—-]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
const dates = ({ start, end }: { start: string; end: string | null }) => [start, end ?? "Present"].filter(Boolean).join(" - ");

const sections = (cv: PdfCv) =>
  [
    cv.summary && "Summary",
    cv.experience.length && "Work Experience",
    cv.projects.length && "Projects",
    cv.education.length && "Education",
    cv.skills.length && "Additional Information",
  ].filter((s): s is string => !!s);

export function atsKeywords(cv: PdfCv) {
  const { name, phone, email, github, linkedin, website } = cv.author;
  return [
    name,
    phone,
    email,
    github,
    linkedin,
    website,
    ...cv.experience.flatMap((job) => [job.company, job.title, dates(job), ...job.bullets]),
    ...cv.projects.flatMap((project) => [project.name, ...project.bullets]),
    ...cv.education.flatMap((school) => [school.institution, school.qualification, dates(school), ...school.details]),
    ...cv.skills.flatMap((group) => [group.label, ...group.items]),
    ...sections(cv),
  ].filter(Boolean);
}

function lines(runs: TextRun[], splitColumns: boolean) {
  const out: Line[] = [];
  for (const run of runs) {
    if (!run.str.trim()) continue;
    const last = out.at(-1);
    const gap = last ? run.x - last.x1 : 0;
    const sameLine = last && Math.abs(run.y - last.y) < SAME_LINE * run.height && !(splitColumns && (gap > COLUMN_GAP * run.height || gap < -WORD_GAP * run.height));
    if (sameLine) {
      last.text += (gap > WORD_GAP * run.height ? " " : "") + run.str;
      last.x1 = run.x + run.width;
    } else out.push({ x0: run.x, x1: run.x + run.width, y: run.y, height: run.height, text: run.str });
  }
  return out;
}

export const streamText = (pages: TextRun[][]) => pages.flatMap((runs) => lines(runs, false).map((line) => line.text));

export function blockText(pages: TextRun[][]) {
  return pages.flatMap((runs) => {
    const sorted = lines([...runs].sort((a, b) => b.y - a.y || a.x - b.x), true).sort((a, b) => b.y - a.y || a.x0 - b.x0);
    const blocks: Line[][] = [];
    for (const line of sorted) {
      const block = blocks.find((b) => {
        const last = b.at(-1)!;
        return last.y - line.y > 0 && last.y - line.y <= BLOCK_PITCH * line.height && Math.abs(last.x0 - line.x0) <= BLOCK_ALIGN * line.height;
      });
      if (block) block.push(line);
      else blocks.push([line]);
    }
    return blocks.sort((a, b) => b[0].y - a[0].y || a[0].x0 - b[0].x0).flatMap((block) => block.map((line) => line.text));
  });
}

function found(label: string, why: string, text: string, wanted: string[]): AtsCheck {
  const missing = wanted.filter((w) => !text.includes(norm(w)));
  return { label, why, pass: !missing.length, detail: `${wanted.length - missing.length}/${wanted.length} found intact`, missing };
}

function inOrder(text: string, sequence: string[]) {
  let from = 0;
  for (const item of sequence) {
    const at = text.indexOf(norm(item), from);
    if (at < 0) return item;
    from = at + norm(item).length;
  }
  return null;
}

export function atsReport(cv: PdfCv, pages: TextRun[][]): AtsCheck[] {
  const stream = streamText(pages);
  const streamJoined = norm(stream.join(" "));
  const blocksJoined = norm(blockText(pages).join(" "));
  const keywords = atsKeywords(cv);
  const dated = [
    ...cv.experience.map((job) => [job.company, dates(job), ...job.bullets.slice(0, 1)]),
    ...cv.education.map((school) => [school.institution, dates(school), ...school.details.slice(0, 1)]),
  ];
  const misplaced = dated.filter((seq) => inOrder(streamJoined, seq)).map((seq) => `${seq[0]} → ${seq[1]}`);
  const headings = sections(cv);
  const outOfOrder = inOrder(blocksJoined, headings);
  return [
    found("Keywords, drawing order", "Simple parsers read text in the order the PDF draws it.", streamJoined, keywords),
    found("Keywords, layout order", "Most parsers group lines into blocks by position, then read the blocks.", blocksJoined, keywords),
    {
      label: "Name on its own first line",
      why: "Parsers take the first line as the candidate's name.",
      pass: norm(stream[0] ?? "") === norm(cv.author.name),
      detail: `First line: “${stream[0] ?? ""}”`,
    },
    {
      label: "Dates follow their role",
      why: "Each date range has to sit between its company and that job's bullets, so a parser attaches it to the right job.",
      pass: !misplaced.length,
      detail: misplaced.length ? `${misplaced.length} out of order` : `${dated.length}/${dated.length} in order`,
      missing: misplaced,
    },
    {
      label: "Section headings in order",
      why: "Parsers split the CV into sections by these headings.",
      pass: !outOfOrder,
      detail: outOfOrder ? `“${outOfOrder}” is missing or out of place` : headings.join(" · "),
    },
  ];
}
