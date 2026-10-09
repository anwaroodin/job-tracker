import { newId } from "~/lib/cv";
import type { CoverLetter, CvBullet, TailoredCv } from "~/types/cv";
import { list, obj, skillGroups, str, strings } from "./clean";

const MAX_TEXT = 1500;
const MAX_BOLD = 4;

export function coverLetterFrom(raw: unknown): CoverLetter {
  const letter = obj(raw);
  return {
    greeting: str(letter.greeting),
    paragraphs: list(letter.paragraphs).map((p) => str(p, MAX_TEXT)).filter(Boolean),
    signOff: str(letter.signOff),
  };
}

const boldIn = (raw: unknown, text: string) => strings(raw, 80).filter((phrase) => text.includes(phrase)).slice(0, MAX_BOLD);

function bullets(raw: unknown): CvBullet[] {
  return list(raw)
    .map((b) => obj(b))
    .map((b) => {
      const text = str(b.text, MAX_TEXT);
      const bold = boldIn(b.bold, text);
      return { id: str(b.id, 40) || newId(), text, ...(bold.length && { bold }) };
    })
    .filter((b) => b.text);
}

function kept<T extends { id: string }>(previous: T[], raw: unknown, edit: (entry: T, edited: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(raw)) return previous;
  const byId = new Map(previous.map((entry) => [entry.id, entry]));
  return list(raw).flatMap((item) => {
    const edited = obj(item);
    const entry = byId.get(str(edited.id, 40));
    return entry ? [edit(entry, edited)] : [];
  });
}

export function applyEdits(previous: TailoredCv, raw: unknown): TailoredCv {
  const edited = obj(raw);
  const summary = str(edited.summary, MAX_TEXT);
  const summaryBold = boldIn(edited.summaryBold, summary);
  return {
    ...previous,
    summary,
    summaryBold: summaryBold.length ? summaryBold : undefined,
    experience: kept(previous.experience, edited.experience, (role, e) => ({ ...role, bullets: bullets(e.bullets) })),
    projects: kept(previous.projects, edited.projects, (project, e) => ({ ...project, bullets: bullets(e.bullets) })),
    education: kept(previous.education, edited.education, (school, e) => ({ ...school, details: strings(e.details, MAX_TEXT) })),
    skills: skillGroups(edited.skills),
    coverLetter: coverLetterFrom(edited.coverLetter),
    flags: [],
  };
}
