import { escapeInlineMarkdown } from "@pdfme/schemas/utils";
import type { PdfCv } from "~/types/cv";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const literalBraces = (value: string) => value.replace(/[{}]/g, (c) => `{'\\u${c === "{" ? "007b" : "007d"}'}`);
const href = (url: string) => url.replace(/[(){}\s]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export const md = (value: string) => literalBraces(escapeInlineMarkdown(value));
export const link = (label: string, url: string) => `[${md(label)}](${href(url)})`;
export const site = (url: string) => link(url, `https://${url}`);
export const dates = ({ start, end }: { start: string; end: string | null }, dash: string) => md([start, end ?? "Present"].filter(Boolean).join(dash));

export function emphasis(value: string, phrases: string[] = []) {
  const wanted = phrases.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!wanted.length) return md(value);
  const pattern = new RegExp(`(${wanted.map(escapeRegex).join("|")})`, "g");
  return value
    .split(pattern)
    .map((part, i) => (i % 2 ? `**${md(part)}**` : md(part)))
    .join("");
}

export type ContactKey = "phone" | "location" | "email" | "github" | "linkedin" | "website";
export type ContactItem = { key: ContactKey; label: string; url?: string };

export function contactItems(author: PdfCv["author"], order: ContactKey[]): ContactItem[] {
  const url = (key: ContactKey, value: string) => (key === "email" ? `mailto:${value}` : key === "phone" || key === "location" ? undefined : `https://${value}`);
  return order.filter((key) => author[key]).map((key) => ({ key, label: author[key], url: url(key, author[key]) }));
}

export const contactText = ({ label, url }: ContactItem) => (url ? link(label, url) : md(label));
