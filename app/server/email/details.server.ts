import * as chrono from "chrono-node";
import type { BodyLink } from "../gmail/api.server";

const MAX_DATES = 12;
const MAX_LINKS = 15;
const CONTEXT_CHARS = 70;

const JUNK_LINK =
  /unsubscribe|preferences|privacy|terms|cookie|view (in|this email in) (your )?browser|view online|facebook\.com|twitter\.com|\/\/x\.com|instagram\.com|youtube\.com|tiktok\.com|glassdoor\.|\.(png|jpe?g|gif|svg)(\?|$)/i;

export interface DateCandidate {
  text: string;
  context: string;
  at: string;
}

export function findDates(text: string, receivedAt: string): DateCandidate[] {
  const seen = new Set<string>();
  return chrono.en.GB.parse(text, new Date(receivedAt), { forwardDate: true }).flatMap((result) => {
    const at = wallClock(result.start);
    const key = `${at}|${result.text.toLowerCase()}`;
    if (seen.has(key) || seen.size >= MAX_DATES) return [];
    seen.add(key);
    const start = Math.max(0, result.index - CONTEXT_CHARS);
    const end = Math.min(text.length, result.index + result.text.length + CONTEXT_CHARS);
    return [{ text: result.text, context: text.slice(start, end).trim(), at }];
  });
}

export function findLinks(links: BodyLink[]) {
  return links.filter((link) => !JUNK_LINK.test(`${link.url} ${link.text}`)).slice(0, MAX_LINKS);
}

function wallClock(components: chrono.ParsedComponents) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${components.get("year")}-${pad(components.get("month") ?? 1)}-${pad(components.get("day") ?? 1)}`;
  if (!components.isCertain("hour")) return date;
  return `${date}T${pad(components.get("hour") ?? 0)}:${pad(components.get("minute") ?? 0)}`;
}
