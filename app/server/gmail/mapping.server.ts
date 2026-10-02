const MAX_BODY_CHARS = 6000;
const MAX_LINKS = 40;
const INVISIBLE_CHARS = /[\u034f\u200b-\u200d\u2060\ufeff\u00ad]/g;

export interface GmailMessage {
  id: string;
  threadId: string | null;
  subject: string;
  snippet: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
  sent: boolean;
}

export interface BodyLink {
  url: string;
  text: string;
}

export interface EmailBody {
  text: string;
  links: BodyLink[];
}

interface RawPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: RawPart[];
}

export interface RawMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: RawPart & { headers?: { name: string; value: string }[] };
}

export function toMessage(raw: RawMessage): GmailMessage {
  const header = (name: string) =>
    raw.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const { name, address } = parseFrom(header("From"));
  return {
    id: raw.id,
    threadId: raw.threadId ?? null,
    subject: header("Subject"),
    snippet: decodeEntities(raw.snippet ?? ""),
    fromName: name,
    fromAddress: address,
    receivedAt: new Date(Number(raw.internalDate ?? Date.now())).toISOString(),
    sent: raw.labelIds?.includes("SENT") ?? false,
  };
}

export function toBody(raw: RawMessage) {
  const plainData = findPart(raw.payload, "text/plain");
  const htmlData = findPart(raw.payload, "text/html");
  const plain = plainData ? decodeBase64Url(plainData) : "";
  const html = htmlData ? decodeBase64Url(htmlData) : "";
  const text = withoutQuotedReply(plain || htmlToText(html)).replace(INVISIBLE_CHARS, "");
  return {
    id: raw.id,
    text: text.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS),
    links: extractLinks(html, plain),
  };
}

function extractLinks(html: string, plain: string): BodyLink[] {
  const links = new Map<string, string>();
  const add = (url: string, text: string) => {
    if (!/^https?:\/\//i.test(url) || links.size >= MAX_LINKS) return;
    const label = text.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!links.get(url)) links.set(url, label);
  };
  for (const [, href, inner] of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    add(decodeEntities(href), htmlToText(inner));
  }
  for (const [url] of plain.matchAll(/https?:\/\/[^\s<>()"']+/g)) add(url.replace(/[.,;:!?]+$/, ""), "");
  return [...links].map(([url, text]) => ({ url, text }));
}

function findPart(part: RawPart | undefined, mimeType: string): string | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data) return part.body.data;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return undefined;
}

function decodeBase64Url(data: string) {
  const binary = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function withoutQuotedReply(text: string) {
  const quoteStart = /^(On [^\n]{1,200}(\n[^\n]{0,100})?wrote:$|-{2,} ?Original Message ?-{2,}|From: .+\nSent: )/im.exec(text);
  return quoteStart ? text.slice(0, quoteStart.index) : text;
}

export function parseFrom(from: string) {
  const m = /^\s*"?(.*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (m) return { name: m[1].trim(), address: m[2].trim().toLowerCase() };
  return { name: "", address: from.trim().toLowerCase() };
}

// snippets come back html escaped
function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
