import type { Application } from "~/types/application";
import type { JobKeywords } from "~/types/cv";

const KEYWORDS_VERSION = "resume-matcher-2";

async function hashOf(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function storedJobKeywords(row: Pick<Application, "description" | "jdKeywordsJson">): Promise<JobKeywords | null> {
  try {
    const stored = row.jdKeywordsJson ? JSON.parse(row.jdKeywordsJson) : null;
    return stored?.v === KEYWORDS_VERSION && stored.hash === (await hashOf(row.description)) ? stored.keywords : null;
  } catch {
    return null;
  }
}

export async function jobKeywordsJson(description: string, keywords: JobKeywords) {
  return JSON.stringify({ v: KEYWORDS_VERSION, hash: await hashOf(description), keywords });
}
