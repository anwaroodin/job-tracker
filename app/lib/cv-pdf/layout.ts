import { mm2pt, pt2mm, type Schema, type Template } from "@pdfme/common";
import type { PdfCv } from "~/types/cv";
import type { Design } from "./designs";
import { FONTS, type FontName } from "./fonts";
import { CONTACT_ICONS } from "./icons";
import { contactItems, contactText, dates, emphasis, link, md, site } from "./markdown";

const DATES_WIDTH = 45;
const FIT_SLACK = 0.5;
const LAYOUT_FIRST_MM = 0.02;

type Box = { pt?: number; font?: FontName; lineHeight?: number; x?: number; width?: number; alignment?: "left" | "center" | "right"; lift?: number; spacing?: number; dy?: number };

export type TextWidth = (text: string, pt: number, font: FontName) => number;

export function cvTemplate(cv: PdfCv, design: Design, textWidth: TextWidth): Template {
  const schemas: Schema[] = [];
  const margin = pt2mm(design.margin);
  const width = design.page.width - 2 * margin;
  const lineHeight = design.line / design.body;
  const fit = mm2pt(width) - FIT_SLACK;
  const indent = pt2mm(design.bullet.indent);
  const variants = { bold: design.fonts.bold, italic: design.fonts.italic, boldItalic: design.fonts.boldItalic };
  let baseline = design.name.baseline;
  let afterRule = false;

  const top = (pt: number, font: FontName, lh: number) => baseline - FONTS[font].ascent * pt - ((lh - 1) * pt) / 2;
  const name = () => `t${schemas.length}`;
  const nameTop = top(design.name.pt, design.name.font, design.name.lineHeight);

  const add = (content: string, box: Box = {}) => {
    const { pt = design.body, font = design.fonts.body, lineHeight: lh = lineHeight, x = 0, alignment = "left", lift = 0, spacing = 0, dy = 0 } = box;
    const ascent = Math.max(FONTS[font].ascent, content.includes("**") ? FONTS[design.fonts.bold].ascent : 0);
    schemas.push({
      name: name(),
      type: "text",
      readOnly: true,
      content,
      position: { x: margin + x, y: pt2mm(top(pt, font, lh) + dy) - lift },
      width: box.width ?? width,
      height: pt2mm(ascent * pt * lh),
      fontSize: pt,
      lineHeight: lh,
      fontName: font,
      fontVariants: variants,
      textFormat: "inline-markdown",
      overflow: "expand",
      alignment,
      verticalAlignment: "top",
      characterSpacing: spacing,
      fontColor: design.color,
      backgroundColor: "",
    });
  };

  const rule = ({ pt, color }: { pt: number; color: string }) =>
    schemas.push({ name: name(), type: "rectangle", position: { x: margin, y: pt2mm(baseline) }, width, height: pt2mm(pt), color, borderColor: "", borderWidth: 0 });

  const dot = () => {
    const y = top(design.body, design.fonts.body, lineHeight);
    const height = baseline - y;
    const { indent: boxWidth, x, rise, r } = design.bullet;
    schemas.push({
      name: name(),
      type: "svg",
      readOnly: true,
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boxWidth} ${height}"><circle cx="${x}" cy="${height - rise}" r="${r}" fill="${design.color}"/></svg>`,
      position: { x: margin, y: pt2mm(y) - LAYOUT_FIRST_MM },
      width: indent,
      height: pt2mm(height),
    });
  };

  const row = (left: string, right = "", font = design.fonts.body) => {
    add(left, { font, width: right ? width - DATES_WIDTH : width });
    if (right) add(right, { x: width - DATES_WIDTH, width: DATES_WIDTH, alignment: "right", lift: LAYOUT_FIRST_MM });
  };
  const nextRow = (left: string, right = "", font = design.fonts.body) => {
    baseline += design.gap.subtitle;
    row(left, right, font);
  };
  const bullets = (items: string[], pitch = design.gap.bullet, first = design.gap.firstBullet) =>
    items.forEach((item, i) => {
      baseline += i ? pitch : first;
      dot();
      add(item, { x: indent, width: width - indent });
    });
  const caps = (value: string, upper?: boolean) => md(upper ? value.toUpperCase() : value);

  const section = (title: string, entries: (() => void)[]) => {
    if (!entries.length) return;
    const { heading, headingRule } = design;
    baseline += afterRule ? heading.afterRule : heading.gap;
    afterRule = false;
    add(caps(title, heading.upper), { pt: heading.pt, font: heading.font, lineHeight: 1, spacing: heading.spacing });
    if (headingRule) {
      baseline += headingRule.gap;
      rule(headingRule);
    }
    entries.forEach((entry, i) => {
      baseline += i ? design.gap.nextEntry : design.gap.firstEntry;
      entry();
    });
  };

  const pack = <T extends { w: number }>(cells: T[], gap: number) => {
    const rows: T[][] = [];
    let used = Infinity;
    for (const cell of cells) {
      used += gap + cell.w;
      if (used > fit) {
        rows.push([]);
        used = cell.w;
      }
      rows[rows.length - 1].push(cell);
    }
    return rows;
  };

  const contactRows = () => {
    const { pt, order, icons, align, separator = "" } = design.contact;
    const measure = (label: string) => textWidth(label, pt, design.fonts.body);
    const items = contactItems(cv.author, order);
    if (!icons) {
      const lines = pack(items.map((item) => ({ item, w: measure(item.label) })), measure(separator));
      if (lines.length) add(lines.map((line) => line.map(({ item }) => contactText(item)).join(separator)).join("\n"), { pt, alignment: align });
      return;
    }
    const size = design.body;
    const rows = pack(items.map((item) => ({ item, w: size + icons.gap + measure(item.label) })), icons.itemGap);
    rows.forEach((row, i) => {
      if (i) baseline += icons.row;
      const total = row.reduce((sum, cell) => sum + cell.w + icons.itemGap, -icons.itemGap);
      let x = align === "center" ? (fit + FIT_SLACK - total) / 2 : 0;
      for (const { item, w } of row) {
        schemas.push({
          name: name(),
          type: "svg",
          readOnly: true,
          content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="${icons.color}">${CONTACT_ICONS[item.key]}</svg>`,
          position: { x: margin + pt2mm(x), y: pt2mm(baseline - icons.rise - size / 2) },
          width: pt2mm(size),
          height: pt2mm(size),
        });
        add(contactText(item), { pt, x: pt2mm(x + size + icons.gap), width: pt2mm(w - size - icons.gap + FIT_SLACK) });
        x += w + icons.itemGap;
      }
    });
  };

  const { name: title, headerRule } = design;
  add(caps(cv.author.name, title.upper), { pt: title.pt, font: title.font, lineHeight: title.lineHeight, alignment: title.align, spacing: title.spacing });
  baseline += design.contact.gap;
  contactRows();
  if (headerRule) {
    baseline += headerRule.gap;
    rule(headerRule);
    afterRule = true;
  }

  const classic = design.entries === "classic";
  const inline = design.links === "inline";
  const when = (item: { start: string; end: string | null }) => dates(item, design.dash);

  section("Summary", cv.summary ? [() => row(emphasis(cv.summary, cv.summaryBold))] : []);
  section(
    "Work Experience",
    cv.experience.map((job) => () => {
      const url = job.url && `(${site(job.url)})`;
      if (classic) {
        const where = [job.location && md(job.location), url].filter(Boolean).join(" ");
        row(`**${md(job.company)}**${where && `, ${where}`}`, when(job));
        nextRow(md(job.title), "", design.fonts.italic);
      } else if (inline) {
        row(`**${job.url ? link(job.company, `https://${job.url}`) : md(job.company)}**`, md(job.location));
        nextRow(md(job.title), when(job));
      } else {
        row(`**${md(job.company)}**${url && ` ${url}`}`, md(job.location));
        nextRow(md(job.title), when(job));
      }
      bullets(job.bullets.map((b, i) => emphasis(b, job.bold[i])));
    }),
  );
  section(
    "Projects",
    cv.projects.map((project) => () => {
      if (classic) {
        const aside = project.url ? site(project.url) : md(project.subtitle);
        row(`**${md(project.name)}**${aside && ` (${aside})`}`);
        if (project.details) nextRow(md(`(${project.details})`), "", design.fonts.italic);
      } else if (inline) {
        const title = project.url ? link(project.name, `https://${project.url}`) : md(project.name);
        row(`**${title}${project.subtitle ? ` (${md(project.subtitle)})` : ""}**`);
        if (project.details) nextRow(md(`(${project.details})`));
      } else {
        const label = !project.url && project.subtitle ? ` · ${md(project.subtitle)}` : "";
        row(`**${md(project.name)}**${label}`, project.url ? site(project.url) : "");
        if (project.details) nextRow(md(project.details));
      }
      bullets(
        project.bullets.map((b, i) => emphasis(b, project.bold[i])),
        design.gap.bullet,
        inline && project.details ? design.gap.bullet : design.gap.firstBullet,
      );
    }),
  );
  section(
    "Education",
    cv.education.map((school) => () => {
      if (classic) {
        row(`**${md(school.institution)}**`, when(school));
        nextRow(md(school.qualification), "", design.fonts.italic);
      } else {
        row(`**${md(school.institution)}**`, md(school.location));
        nextRow(md(school.qualification), when(school));
      }
      bullets(school.details.map(md), design.gap.detail);
    }),
  );
  const skillGrid = ({ columns, gap, keywords }: NonNullable<Design["skills"]>) => {
    const step = (width + pt2mm(gap)) / columns;
    cv.skills.forEach((group, i) => {
      const col = i % columns;
      if (i && !col) baseline += keywords + design.gap.nextEntry;
      const box = { x: col * step, width: step - pt2mm(gap) };
      add(`**${md(group.label)}**`, box);
      add(md(group.items.join(", ")), { ...box, pt: design.body * 0.875, dy: keywords });
    });
    baseline += keywords;
  };
  const skillRows = () =>
    cv.skills.forEach((group, i) => {
      if (i) baseline += design.gap.skill;
      const label = design.plainSkillLabels ? md(group.label) : `**${md(group.label)}**`;
      row(`${label}: ${md(group.items.join(", "))}`);
    });
  const grid = design.skills;
  section("Additional Information", cv.skills.length ? [grid ? () => skillGrid(grid) : skillRows] : []);

  const padding = [pt2mm(Math.min(design.pageTop, nameTop)), margin, pt2mm(design.pageBottom), margin] as [number, number, number, number];
  return { basePdf: { ...design.page, padding }, schemas: [schemas] };
}
