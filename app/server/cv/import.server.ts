import type { CvImportResult } from "~/types/cv";
import type { Db } from "../db/client.server";
import { overJevBudget, recordJevSpend } from "../jev/budget.server";
import { labelLines, pickEntryFields } from "../jev/cv-import.server";
import { blockCandidates, finalize, knownLabels, splitLines, structure } from "./parse";
import { applyPicks, readCv } from "./read";

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 30_000;
const MIN_LINES = 3;

export async function pdfText(file: File) {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
  return text;
}

export async function importCv(env: Env, db: Db, userId: string, text: string): Promise<CvImportResult> {
  const lines = splitLines(text.slice(0, MAX_TEXT_CHARS));
  if (lines.length < MIN_LINES) return { error: "There wasn't enough text to read. Paste the CV's text, or try another PDF." };

  const read = readCv(lines);
  const apiKey = env.TYPESAFE_API_KEY;
  const jevUsable = !!apiKey && !(await overJevBudget(db, userId));

  if (read) {
    if (read.unclear.length && jevUsable) {
      const blocks = read.unclear.map((u) => u.block);
      const entries = await pickEntryFields(apiKey, blocks);
      applyPicks(read.cv, read.unclear, entries.picks, blocks.map(blockCandidates));
      await recordJevSpend(db, userId, "cv-import", entries.spend);
    }
    return { cv: read.cv, lines: lines.length };
  }

  if (!jevUsable) return { error: "This CV has no headings I recognise, and reading it line by line needs Jev, which isn't available right now." };
  const texts = lines.map((l) => l.text);
  const labelled = await labelLines(apiKey, texts, knownLabels(lines));
  const parsed = structure(texts, labelled.labels);
  const entries = await pickEntryFields(apiKey, parsed.blocks);
  await recordJevSpend(db, userId, "cv-import", [...labelled.spend, ...entries.spend]);

  if (labelled.failed) return { error: "Jev couldn't be reached. Try again in a minute." };
  return { cv: finalize(parsed, entries.picks), lines: lines.length };
}
