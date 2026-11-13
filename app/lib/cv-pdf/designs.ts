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

const SLATE = "#20262E";

const RED = "#DC2626";

const ONYX: Design = {
  page: LETTER,
  margin: 14,
  pageTop: 10.66,
  pageBottom: 12,
  color: "#000000",
  underline: { grey: 0, width: 0.5 },
  links: "inline",
  plainSkillLabels: true,
  fonts: { body: "IBM Plex Serif", bold: "IBM Plex Serif Bold", italic: "IBM Plex Serif", boldItalic: "IBM Plex Serif Bold" },
  body: 9,
  line: 12.15,
  name: { font: "IBM Plex Serif SemiBold", pt: 19.5, baseline: 31.99, lineHeight: 1, align: "left" },
  contact: {
    pt: 9,
    gap: 16.21,
    align: "left",
    order: ["email", "phone", "location", "website", "linkedin", "github"],
    icons: { color: RED, gap: 4 / 6, itemGap: 3, rise: 3.38, row: 12.9 },
  },
  headerRule: { gap: 15.2, pt: 1, color: RED },
  heading: { font: "IBM Plex Serif SemiBold", pt: 13, gap: 34.19, afterRule: 27.12 },
  entries: "rows",
  dash: " – ",
  gap: { firstEntry: 15.33, nextEntry: 21.01, subtitle: 12.65, firstBullet: 12.65, bullet: 17.01, detail: 17.01, skill: 16.15 },
  bullet: { indent: 10.33, x: 7.13, rise: 2.74, r: 1.06 },
};

const PERSIAN: Design = {
  page: A4,
  margin: 28,
  pageTop: 28,
  pageBottom: 28,
  color: SLATE,
  underline: null,
  links: "aside",
  fonts: { body: "Inter", bold: "Inter Bold", italic: "Inter", boldItalic: "Inter Bold" },
  body: 9.5,
  line: 12.88,
  name: { font: "Montserrat SemiBold", pt: 22.4, baseline: 40.61, lineHeight: 1, align: "center", upper: true, spacing: 0.9075 },
  contact: {
    pt: 8.3,
    gap: 18.2,
    align: "center",
    order: ["phone", "email", "website", "location", "github", "linkedin"],
    icons: { color: SLATE, gap: 2, itemGap: 15, rise: 4.8, row: 12 },
  },
  headerRule: { gap: 23.8, pt: 1, color: SLATE },
  heading: { font: "Montserrat SemiBold", pt: 9.7, gap: 19.76, afterRule: 16.79, upper: true, spacing: 0.5445 },
  headingRule: { gap: 3.47, pt: 0.5, color: SLATE },
  entries: "rows",
  skills: { columns: 3, gap: 38, keywords: 12.64 },
  dash: " – ",
  gap: { firstEntry: 12.41, nextEntry: 16.62, subtitle: 13.5, firstBullet: 13.5, bullet: 18.03, detail: 18.03, skill: 13.5 },
  bullet: { indent: 12.2, x: 6.87, rise: 2.76, r: 1.49 },
};

export const DESIGNS: Record<CvDesign, Design> = { classic: CLASSIC, onyx: ONYX, persian: PERSIAN };

export const designFonts = (design: Design) => [design.fonts.body, design.fonts.bold, design.fonts.italic, design.fonts.boldItalic, design.name.font, design.heading.font];
