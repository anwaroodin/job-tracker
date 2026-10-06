import { newId } from "~/lib/cv";
import type { CoverLetter, TailoredCv } from "~/types/cv";
import { list, obj, skillGroups, str } from "./clean";

const MAX_TEXT = 1500;

export function coverLetterFrom(raw: unknown): CoverLetter {
  const letter = obj(raw);
  return {
    greeting: str(letter.greeting),
    paragraphs: list(letter.paragraphs).map((p) => str(p, MAX_TEXT)).filter(Boolean),
    signOff: str(letter.signOff),
  };
}

export function applyEdits(previous: TailoredCv, raw: unknown): TailoredCv {
  const edited = obj(raw);
  const bolds = new Map([...previous.experience, ...previous.projects].flatMap((e) => e.bullets).map((b) => [b.id, b.bold]));
  const bullets = (v: unknown) =>
    list(v)
      .map((b) => {
        const id = str(obj(b).id, 40) || newId();
        const bold = bolds.get(id);
        return { id, text: str(obj(b).text, MAX_TEXT), ...(bold && { bold }) };
      })
      .filter((b) => b.text);
  const editedBullets = (key: string) => new Map(list(edited[key]).map((e) => [str(obj(e).id), bullets(obj(e).bullets)]));
  const roles = editedBullets("experience");
  const projects = editedBullets("projects");
  return {
    ...previous,
    summary: str(edited.summary, MAX_TEXT),
    experience: previous.experience.map((role) => ({ ...role, bullets: roles.get(role.id) ?? role.bullets })),
    projects: previous.projects.map((project) => ({ ...project, bullets: projects.get(project.id) ?? project.bullets })),
    skills: skillGroups(edited.skills),
    coverLetter: coverLetterFrom(edited.coverLetter),
    flags: [],
  };
}
