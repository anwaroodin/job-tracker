import { bareUrl, EMPTY_CV, newId } from "~/lib/cv";
import type { Cv } from "~/types/cv";

export const LINE_KINDS = ["heading", "entry", "bullet", "summary", "skills", "certification", "contact", "other"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export interface LineLabel {
  kind: LineKind;
  continues: boolean;
}

export interface CvLine {
  text: string;
  bullet: boolean;
}

export type Section = "summary" | "experience" | "education" | "projects" | "skills" | "certifications" | "other";
export type BlockSection = "experience" | "education" | "projects";

export interface Block {
  section: BlockSection;
  lines: string[];
  bullets: string[];
}

export interface SkillLine {
  label: string;
  items: string[];
}

export interface Structure {
  summary: string[];
  skills: SkillLine[];
  certifications: string[];
  blocks: Block[];
}

export interface BlockPicks {
  title?: number | null;
  company?: number | null;
  location?: number | null;
  qualification?: number | null;
  institution?: number | null;
}

export const MAX_LINES = 300;

const BULLET_GLYPH = /^(?:[•▪●◦‣⁃∙·]|[*\-–—>](?=\s))\s*/;
const MAX_HEADING_WORDS = 5;

export function splitLines(text: string): CvLine[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => {
      const line = l.trim();
      return { text: line.replace(BULLET_GLYPH, "").replace(/\s+/g, " ").trim(), bullet: BULLET_GLYPH.test(line) };
    })
    .filter((l) => l.text)
    .slice(0, MAX_LINES);
}

export function knownLabels(lines: CvLine[]): Partial<LineLabel>[] {
  return lines.map((line, i) => {
    if (headingSection(line.text) !== "other" && line.text.split(" ").length <= MAX_HEADING_WORDS) {
      return { kind: "heading", continues: false };
    }
    if (line.bullet) return { kind: "bullet", continues: false };
    if (i === 0 || RANGE.test(line.text)) return { continues: false };
    return {};
  });
}

const HEADINGS: [Section, RegExp][] = [
  ["summary", /^(professional |personal |career )?(summary|profile|objective|about( me)?)$/i],
  ["skills", /^(interests|hobbies|languages|hobbies (and|&) interests)$/i],
  ["experience", /^(professional |work |relevant |employment )?(experience|employment( history)?|work history|career history)$/i],
  ["education", /^(education|qualifications|education (and|&) (training|qualifications)|academic background)$/i],
  ["projects", /^(personal |side |selected |key )?projects$/i],
  ["skills", /^((technical |key |core )?(skills|competencies|technologies|tech stack)( (and|&) (tools|technologies|interests))?|additional information)$/i],
  ["certifications", /^(certifications?|certificates|licen[cs]es( (and|&) certifications)?|awards( (and|&) certifications)?|courses)$/i],
];

export function headingSection(line: string): Section {
  const text = line.replace(/[:.]$/, "").trim();
  return HEADINGS.find(([, re]) => re.test(text))?.[0] ?? "other";
}

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const POINT = `(?:${MONTH}\\s+\\d{4}|\\d{1,2}/\\d{4}|(?:19|20)\\d{2})`;
const END = `(?:${POINT}|present|current|now|ongoing|today)`;
const RANGE = new RegExp(`(${POINT})\\s*(?:–|—|-|to)\\s*(${END})`, "i");
const YEAR = /\b(?:19|20)\d{2}\b/;
const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|io|dev|app|co\.uk|org|net)(?:\/\S*)?/i;
const OPEN_ENDED = /^(present|current|now|ongoing|today)$/i;

export const hasDateRange = (text: string) => RANGE.test(text);
export const withoutDates = (text: string) => text.replace(RANGE, "").replace(EDGE_SEPARATORS, "");
export const findUrl = (text: string) => URL.exec(text)?.[0] ?? "";

export function findDates(text: string) {
  const range = RANGE.exec(text);
  if (range) return { start: range[1], end: OPEN_ENDED.test(range[2]) ? null : range[2] };
  const year = YEAR.exec(text);
  return { start: "", end: year ? year[0] : null };
}

const EDGE_SEPARATORS = /^[\s,|·•–—-]+|[\s,|·•–—-]+$/g;

export function spans(line: string) {
  const rest = line.replace(RANGE, " ").replace(URL, " ").replace(/[()]/g, " ");
  const parts = rest
    .split(/\s+[|·•–—-]\s+|\s+at\s+|\t|\s{2,}|,\s+/i)
    .map((p) => p.replace(EDGE_SEPARATORS, ""))
    .filter((p) => p.length > 1 && !/^[\d/ ]+$/.test(p));
  const whole = rest.replace(/\s+/g, " ").replace(EDGE_SEPARATORS, "");
  return parts.length > 1 ? [...new Set([...parts, whole])] : parts;
}

export function blockCandidates(block: Block) {
  return [...new Set(block.lines.flatMap(spans))];
}

const MERGEABLE = new Set<LineKind>(["bullet", "summary", "skills", "certification", "other"]);

export function structure(lines: string[], labels: LineLabel[]): Structure {
  const merged: { text: string; kind: LineKind }[] = [];
  lines.forEach((text, i) => {
    const { kind, continues } = labels[i] ?? { kind: "other", continues: false };
    const prev = merged.at(-1);
    if (continues && prev && MERGEABLE.has(prev.kind) && kind !== "heading" && kind !== "entry") {
      prev.text = `${prev.text} ${text}`;
    } else {
      merged.push({ text, kind });
    }
  });

  const out: Structure = { summary: [], skills: [], certifications: [], blocks: [] };
  let section: Section | null = null;
  let block: Block | null = null;
  let lastWasEntry = false;

  const blockSection = (): BlockSection =>
    section === "education" || section === "projects" ? section : "experience";

  for (const { text, kind } of merged) {
    const effective = contextKind(kind, section, block !== null);
    if (effective === "heading") {
      section = headingSection(text);
      block = null;
    } else if (effective === "entry") {
      if (!block || !lastWasEntry || block.bullets.length) {
        block = { section: blockSection(), lines: [], bullets: [] };
        out.blocks.push(block);
      }
      block.lines.push(text);
    } else if (effective === "bullet") {
      if (!block) {
        block = { section: blockSection(), lines: [], bullets: [] };
        out.blocks.push(block);
      }
      block.bullets.push(text);
    } else if (effective === "summary") {
      out.summary.push(text);
    } else if (effective === "skills") {
      const line = splitSkills(text);
      const group = out.skills.find((g) => g.label.toLowerCase() === line.label.toLowerCase());
      if (group) group.items = [...new Set([...group.items, ...line.items])];
      else if (line.items.length) out.skills.push(line);
    } else if (effective === "certification") {
      out.certifications.push(text);
    }
    lastWasEntry = effective === "entry";
  }
  return out;
}

function contextKind(kind: LineKind, section: Section | null, inEntry: boolean): LineKind {
  if (kind === "heading" || kind === "contact" || kind === "entry") return kind;
  if (kind === "skills" && (section === "experience" || section === "projects")) return "entry";
  if (section === "skills") return "skills";
  if (section === "certifications") return "certification";
  if (section === "summary" || (section === null && kind === "bullet" && !inEntry)) return "summary";
  return kind;
}

const SKILL_LABEL = /^([\w &/]{1,30}):\s*/;

export function splitSkills(text: string): SkillLine {
  const label = SKILL_LABEL.exec(text)?.[1].trim() ?? "Skills";
  const items = text
    .replace(SKILL_LABEL, "")
    .split(/\s*[,;|•·]\s*|\s{2,}/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter((s) => s.length > 0 && s.length <= 60);
  return { label, items: [...new Set(items)] };
}

const PARENTHESISED = /^\((.*)\)$/;

export function projectFields(lines: string[]) {
  const [first = "", ...rest] = lines;
  const note = /\(([^)]*)\)/.exec(first)?.[1].trim() ?? "";
  const url = URL.exec(first)?.[0] ?? "";
  return {
    name: first.replace(/\(.*$/, "").replace(URL, "").replace(EDGE_SEPARATORS, ""),
    url: bareUrl(url),
    subtitle: note && !URL.test(note) ? note : "",
    details: rest.map((l) => PARENTHESISED.exec(l.trim())?.[1] ?? "").find(Boolean) ?? "",
  };
}

export function finalize(parsed: Structure, picks: BlockPicks[]): Cv {
  const cv: Cv = structuredClone(EMPTY_CV);
  if (parsed.summary.length) cv.summaries.push({ id: newId(), text: parsed.summary.join(" ") });
  cv.skills = parsed.skills.map((group) => ({ id: newId(), ...group }));
  cv.certifications = parsed.certifications;

  parsed.blocks.forEach((block, i) => {
    const candidates = blockCandidates(block);
    const pick = (index: number | null | undefined) => (index == null ? "" : (candidates[index] ?? ""));
    const { start, end } = findDates(block.lines.join(" "));
    const p = picks[i] ?? {};
    const bullets = block.bullets.map((text) => ({ id: newId(), text }));

    if (block.section === "education") {
      cv.education.push({
        id: newId(),
        institution: pick(p.institution),
        qualification: pick(p.qualification),
        location: pick(p.location),
        start,
        end,
        details: block.bullets,
      });
    } else if (block.section === "projects") {
      cv.projects.push({ id: newId(), ...projectFields(block.lines), bullets });
    } else {
      cv.experience.push({
        id: newId(),
        title: pick(p.title),
        company: pick(p.company),
        location: pick(p.location),
        url: bareUrl(URL.exec(block.lines.join(" "))?.[0] ?? ""),
        start,
        end,
        bullets,
      });
    }
  });
  return cv;
}
