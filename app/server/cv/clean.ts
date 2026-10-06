import { newId } from "~/lib/cv";
import type { CvBullet, Cv, SkillGroup } from "~/types/cv";

const MAX_ITEMS = 60;
const MAX_TEXT = 1500;
const MAX_FIELD = 200;

type Raw = Record<string, unknown>;

export const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
export const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS) : []);
export const str = (v: unknown, max = MAX_FIELD) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const id = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : newId());
export const strings = (v: unknown, max = MAX_FIELD) => [...new Set(list(v).map((s) => str(s, max)).filter(Boolean))];
const end = (v: unknown) => str(v, 40) || null;

function bullets(v: unknown): CvBullet[] {
  return list(v)
    .map((b) => ({ id: id(obj(b).id), text: str(obj(b).text, MAX_TEXT) }))
    .filter((b) => b.text);
}

export function skillGroups(v: unknown): SkillGroup[] {
  const groups = list(v);
  if (groups.some((g) => typeof g === "string")) {
    const items = strings(groups, 60);
    return items.length ? [{ id: newId(), label: "Skills", items }] : [];
  }
  return groups
    .map((g) => obj(g))
    .map((g) => ({ id: id(g.id), label: str(g.label, 60), items: strings(g.items, 60) }))
    .filter((g) => g.items.length);
}

export function cleanCv(input: unknown): Cv {
  const raw = obj(input);
  return {
    summaries: list(raw.summaries)
      .slice(0, 3)
      .map((s) => ({ id: id(obj(s).id), text: str(obj(s).text, MAX_TEXT) }))
      .filter((s) => s.text),
    experience: list(raw.experience)
      .map((e) => obj(e))
      .map((e) => ({
        id: id(e.id),
        company: str(e.company),
        title: str(e.title),
        start: str(e.start, 40),
        end: end(e.end),
        location: str(e.location),
        url: str(e.url, 500),
        bullets: bullets(e.bullets),
      }))
      .filter((e) => e.company || e.title || e.bullets.length),
    education: list(raw.education)
      .map((e) => obj(e))
      .map((e) => ({
        id: id(e.id),
        institution: str(e.institution),
        qualification: str(e.qualification),
        location: str(e.location),
        start: str(e.start, 40),
        end: end(e.end),
        details: strings(e.details, MAX_TEXT),
      }))
      .filter((e) => e.institution || e.qualification),
    projects: list(raw.projects)
      .map((p) => obj(p))
      .map((p) => ({
        id: id(p.id),
        name: str(p.name),
        url: str(p.url, 500),
        subtitle: str(p.subtitle),
        details: str(p.details, 500),
        bullets: bullets(p.bullets),
      }))
      .filter((p) => p.name || p.bullets.length),
    skills: skillGroups(raw.skills),
    certifications: strings(raw.certifications),
    targetRoles: strings(raw.targetRoles, 80),
  };
}
