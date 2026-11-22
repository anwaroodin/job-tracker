import { readJobText } from "~/lib/job-pdf";
import { MAX_PDF_BYTES, pdfText } from "../../cv/import.server";
import type { Db } from "../../db/client.server";
import { overJevBudget, recordJevSpend } from "../../jev/budget.server";
import { readJobWithJev } from "../../jev/job-description.server";

export async function readJobPdf(env: Env, db: Db, userId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.type !== "application/pdf") return { error: "Choose a PDF file." };
  if (file.size > MAX_PDF_BYTES) return { error: "That PDF is over 5 MB." };
  const text = await pdfText(file).catch(() => "");
  if (!text.trim()) return { error: "This PDF has no text to read. It may be a scanned image." };
  return readJobDescription(env, db, userId, text);
}

export async function readJobDescription(env: Env, db: Db, userId: string, text: string) {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey || (await overJevBudget(db, userId))) return { job: readJobText(text).job, jev: false };
  try {
    const { job, spend } = await readJobWithJev(apiKey, text);
    await recordJevSpend(db, userId, "job-pdf", spend);
    return { job, jev: true };
  } catch (error) {
    console.error("jev job description failed", error);
    return { job: readJobText(text).job, jev: false };
  }
}
