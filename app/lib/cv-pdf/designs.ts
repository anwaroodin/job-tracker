import type { CvDesign } from "~/types/cv";
import type { FontName } from "./fonts";
import type { ContactKey } from "./markdown";

type Text = { font: FontName; pt: number; upper?: boolean; spacing?: number };
type Rule = { gap: number; pt: number; color: string };

export type Design = {
  page: { width: number; height: number };
  margin: number;
  pageTop: number;
  pageBottom: number;
  color: string;
  underline: { grey: number; width?: number } | null;
  links: "inline" | "aside";
  plainSkillLabels?: boolean;
  fonts: { body: FontName; bold: FontName; italic: FontName; boldItalic: FontName };
  body: number;
  line: number;
  name: Text & { baseline: number; lineHeight: number; align: "left" | "center" };
  contact: { pt: number; gap: number; align: "left" | "center"; order: ContactKey[]; separator?: string; icons?: { color: string; gap: number; itemGap: number; rise: number; row: number } };
  headerRule?: Rule;
  heading: Text & { gap: number; afterRule: number };
  headingRule?: Rule;
  entries: "classic" | "rows";
  skills?: { columns: number; gap: number; keywords: number };
  dash: string;
  gap: { firstEntry: number; nextEntry: number; subtitle: number; firstBullet: number; bullet: number; detail: number; skill: number };
  bullet: { indent: number; x: number; rise: number; r: number };
};

const LETTER = { width: 215.9, height: 279.4 };
const A4 = { width: 210, height: 297 };

const CLASSIC: Design = {
  page: LETTER,
  margin: 14,
  pageTop: 12,
  pageBottom: 12,
  color: "#000000",
  underline: { grey: 0.6 },
  links: "aside",
  fonts: { body: "Termes", bold: "Termes Bold", italic: "Termes Italic", boldItalic: "Termes Bold Italic" },
  body: 10.25,
  line: 13.45,
  name: { font: "Termes Bold", pt: 20.5, baseline: 32.05, lineHeight: 0.72, align: "left" },
  contact: { pt: 9.74, gap: 20.33, align: "left", order: ["phone", "location", "email", "github", "linkedin", "website"], separator: " | " },
  heading: { font: "Termes Small Caps", pt: 12.3, gap: 22.51, afterRule: 22.51 },
  headingRule: { gap: 3.73, pt: 1, color: "#000000" },
  entries: "classic",
  dash: " - ",
  gap: { firstEntry: 15.02, nextEntry: 18.76, subtitle: 13.36, firstBullet: 13.45, bullet: 13.45, detail: 13.45, skill: 13.59 },
  bullet: { indent: 8.71, x: 1.79, rise: 3.39, r: 1.38 },
};

export const DESIGNS: Record<CvDesign, Design> = { classic: CLASSIC };

export const designFonts = (design: Design) => [design.fonts.body, design.fonts.bold, design.fonts.italic, design.fonts.boldItalic, design.name.font, design.heading.font];
