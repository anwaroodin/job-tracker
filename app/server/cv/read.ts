import { bareUrl, EMPTY_CV, newId } from "~/lib/cv";
import type { Cv, CvBullet } from "~/types/cv";
import {
  findDates,
  findUrl,
  hasDateRange,
  headingSection,
  projectFields,
  splitSkills,
  withoutDates,
  type Block,
  type BlockPicks,
  type CvLine,
  type Section,
} from "./parse";

const MAX_HEADING_WORDS = 5;
const MIN_SUMMARY_CHARS = 60;
const CONTACT = /@|\||linkedin|github|\+?\d[\d ()-]{7,}/i;

interface Entry {
  header: string[];
  bullets: string[];
}

export interface ReadCv {
  cv: Cv;
  unclear: { block: Block; index: number }[];
}

const isHeading = (line: CvLine) =>
  !line.bullet && headingSection(line.text) !== "other" && line.text.split(" ").length <= MAX_HEADING_WORDS;

const startsLowercase = (text: string) => /^[a-z0-9(,&]/.test(text);
const parenthesised = (text: string) => /^\(.*\)$/.test(text.trim());

function sectionsOf(lines: CvLine[]) {
  const sections: { section: Section; label: string; lines: CvLine[] }[] = [];
  const preamble: CvLine[] = [];
  for (const line of lines) {
    if (isHeading(line)) sections.push({ section: headingSection(line.text), label: line.text.replace(/[:.]$/, ""), lines: [] });
    else (sections.at(-1)?.lines ?? preamble).push(line);
  }
  return { sections, preamble };
}

function entriesOf(section: Section, lines: CvLine[]): Entry[] {
  const entries: Entry[] = [];
  lines.forEach((line, i) => {
    const entry = entries.at(-1);
    const next = lines[i + 1];
    if (line.bullet) {
      if (entry) entry.bullets.push(line.text);
      else entries.push({ header: [], bullets: [line.text] });
      return;
    }
    const dated = hasDateRange(line.text);
    const titleBeforeDates = !!next && !next.bullet && hasDateRange(next.text) && !startsLowercase(line.text);
    const projectStart =
      section === "projects" && !startsLowercase(line.text) && (/\)$/.test(line.text) || (!!next && parenthesised(next.text)));
    const startsEntry = entry?.bullets.length
      ? dated || titleBeforeDates || projectStart
      : dated && !!entry?.header.some(hasDateRange);
    if (!entry || startsEntry) {
      entries.push({ header: [line.text], bullets: [] });
    } else if (!entry.bullets.length) {
      entry.header.push(line.text);
    } else {
      entry.bullets[entry.bullets.length - 1] += ` ${line.text}`;
    }
  });
  return entries;
}

const bulletsOf = (texts: string[]): CvBullet[] => texts.map((text) => ({ id: newId(), text }));

function splitPlace(text: string) {
  const [first, ...rest] = text.split(/,\s+/);
  return { name: first.trim(), location: rest.join(", ").trim() };
}

function experience(entry: Entry, unclear: ReadCv["unclear"], index: number) {
  const dated = entry.header.find(hasDateRange) ?? entry.header[0] ?? "";
  const others = entry.header.filter((line) => line !== dated);
  const { start, end } = findDates(dated);
  const url = findUrl(entry.header.join(" "));
  const strip = (line: string) => withoutDates((url ? line.replace(url, "") : line).replace(/\(\s*\)/g, ""));
  const datedText = strip(dated);
  const job = { id: newId(), title: "", company: "", location: "", url: bareUrl(url), start, end, bullets: bulletsOf(entry.bullets) };

  if (others.length === 1 && datedText.includes(",")) {
    const { name, location } = splitPlace(datedText);
    return { ...job, company: name, location, title: strip(others[0]) };
  }
  const at = /^(.+?)\s+at\s+(.+)$/i.exec(datedText);
  if (!others.length && at) return { ...job, title: at[1], company: at[2] };

  unclear.push({ block: { section: "experience", lines: entry.header, bullets: entry.bullets }, index });
  return { ...job, title: strip(others[0] ?? ""), company: datedText };
}

function education(entry: Entry) {
  const dated = entry.header.find(hasDateRange) ?? entry.header[0] ?? "";
  const others = entry.header.filter((line) => line !== dated);
  const { start, end } = findDates(dated);
  const { name, location } = splitPlace(withoutDates(dated));
  return {
    id: newId(),
    institution: name,
    location,
    qualification: others.join(" ").trim(),
    start,
    end,
    details: entry.bullets,
  };
}

export function readCv(lines: CvLine[]): ReadCv | null {
  const { sections, preamble } = sectionsOf(lines);
  if (!sections.some((s) => s.section === "experience" || s.section === "education")) return null;

  const cv: Cv = structuredClone(EMPTY_CV);
  const unclear: ReadCv["unclear"] = [];
  const summary = preamble.filter((l) => !CONTACT.test(l.text) && l.text.length >= MIN_SUMMARY_CHARS).map((l) => l.text);

  for (const { section, label, lines: body } of sections) {
    if (section === "summary") {
      summary.push(...body.map((l) => l.text));
    } else if (section === "experience") {
      for (const entry of entriesOf(section, body)) cv.experience.push(experience(entry, unclear, cv.experience.length));
    } else if (section === "education") {
      for (const entry of entriesOf(section, body)) cv.education.push(education(entry));
    } else if (section === "projects") {
      for (const entry of entriesOf(section, body)) cv.projects.push({ id: newId(), ...projectFields(entry.header), bullets: bulletsOf(entry.bullets) });
    } else if (section === "skills") {
      body.forEach((line, i) => {
        const group = cv.skills.at(-1);
        const continues = group && !/^[\w &/]{1,30}:/.test(line.text) && body[i - 1]?.text.trimEnd().endsWith(",");
        const { label: own, items } = splitSkills(line.text);
        if (continues) group.items = [...new Set([...group.items, ...items])];
        else cv.skills.push({ id: newId(), label: own === "Skills" ? label : own, items });
      });
    } else if (section === "certifications") {
      cv.certifications.push(...body.map((l) => l.text));
    }
  }

  if (summary.length) cv.summaries.push({ id: newId(), text: summary.join(" ") });
  cv.skills = cv.skills.filter((g) => g.items.length);
  return { cv, unclear };
}

export function applyPicks(cv: Cv, unclear: ReadCv["unclear"], picks: BlockPicks[], candidates: string[][]) {
  unclear.forEach(({ index }, i) => {
    const pick = (n: number | null | undefined) => (n == null ? "" : (candidates[i][n] ?? ""));
    const job = cv.experience[index];
    const p = picks[i] ?? {};
    if (p.title != null) job.title = pick(p.title);
    if (p.company != null) job.company = pick(p.company);
    if (p.location != null) job.location = pick(p.location);
  });
}
