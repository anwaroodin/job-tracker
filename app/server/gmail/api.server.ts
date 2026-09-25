const API = "https://gmail.googleapis.com";
const BATCH_SIZE = 50;
const BATCH_GAP_MS = 1100;

export class GmailAuthError extends Error {}

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

export async function listMessageIds(
  token: string,
  q: string,
  maxPages: number,
): Promise<{ ids: string[]; truncated: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      q,
      maxResults: "500",
      fields: "messages/id,nextPageToken",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${API}/gmail/v1/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await throwIfAuthError(res);
    if (!res.ok) throw new Error(`Gmail list failed: ${res.status} ${await errorReason(res)}`);
    const body = (await res.json()) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };
    for (const m of body.messages ?? []) ids.push(m.id);
    pageToken = body.nextPageToken;
    if (!pageToken) return { ids, truncated: false };
  }
  return { ids, truncated: true };
}

const METADATA_QUERY =
  "format=metadata&metadataHeaders=From&metadataHeaders=Subject" +
  "&fields=id,threadId,snippet,internalDate,labelIds,payload/headers";
const BODY_QUERY = "format=full&fields=id,payload(mimeType,body/data,parts)";
const MAX_BODY_CHARS = 6000;
const MAX_LINKS = 40;
const INVISIBLE_CHARS = /[\u034f\u200b-\u200d\u2060\ufeff\u00ad]/g;

export interface BodyLink {
  url: string;
  text: string;
}

export interface EmailBody {
  text: string;
  links: BodyLink[];
}

interface Batched<T> {
  messages: T[];
  missing: string[];
  failed: string[];
}

export function getMessagesMetadata(token: string, ids: string[]) {
  return getInBatches(token, ids, METADATA_QUERY, toMessage);
}

export async function getMessageBodies(token: string, ids: string[]) {
  const { messages } = await getInBatches(token, ids, BODY_QUERY, toBody);
  return new Map<string, EmailBody>(
    messages.filter((m) => m.text || m.links.length).map(({ id, text, links }) => [id, { text, links }]),
  );
}

export async function getMailboxAddress(token: string) {
  const res = await fetch(`${API}/gmail/v1/users/me/profile?fields=emailAddress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfAuthError(res);
  if (!res.ok) throw new Error(`Gmail profile failed: ${res.status} ${await errorReason(res)}`);
  const { emailAddress } = (await res.json()) as { emailAddress: string };
  return emailAddress.toLowerCase();
}

async function getInBatches<T>(
  token: string,
  ids: string[],
  query: string,
  parse: (raw: RawMessage) => T,
): Promise<Batched<T>> {
  const out: Batched<T> = { messages: [], missing: [], failed: [] };
  let lastBatchAt = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    // a full batch is 250 quota units, which is gmail's per user limit per
    // second. firing them back to back gets a chunk of each one rate limited
    const wait = lastBatchAt + BATCH_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastBatchAt = Date.now();
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const r = await batchGet(token, chunk, query, parse);
    out.messages.push(...r.messages);
    out.missing.push(...r.missing);
    out.failed.push(...r.failed);
  }
  return out;
}

async function batchGet<T>(token: string, ids: string[], query: string, parse: (raw: RawMessage) => T) {
  const boundary = `batch_${crypto.randomUUID()}`;
  const body =
    ids
      .map(
        (id, i) =>
          `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <m${i}>\r\n\r\n` +
          `GET /gmail/v1/users/me/messages/${id}?${query}\r\n\r\n`,
      )
      .join("") + `--${boundary}--`;

  const res = await fetch(`${API}/batch/gmail/v1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
    body,
  });
  await throwIfAuthError(res);
  if (!res.ok) return { messages: [], missing: [], failed: ids };

  const resBoundary = /boundary=("?)([^";]+)\1/.exec(res.headers.get("content-type") ?? "")?.[2];
  if (!resBoundary) return { messages: [], missing: [], failed: ids };
  return parseBatchResponse(await res.text(), resBoundary, ids, parse);
}

// google sends 403 for rate limits
async function errorReason(res: Response) {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; errors?: { reason?: string }[] };
  } | null;
  return [body?.error?.errors?.[0]?.reason, body?.error?.message].filter(Boolean).join(": ");
}

async function throwIfAuthError(res: Response) {
  if (res.status === 401) throw new GmailAuthError("Gmail rejected the token (401)");
  if (res.status === 403) {
    const text = await res.clone().text();
    if (!/rateLimit|quota/i.test(text)) {
      throw new GmailAuthError("Gmail access not granted (403)");
    }
  }
}

export function parseBatchResponse<T>(
  text: string,
  boundary: string,
  ids: string[],
  parse: (raw: RawMessage) => T,
): Batched<T> {
  const messages: T[] = [];
  const missing: string[] = [];
  const answered = new Set<string>();

  for (const part of text.split(`--${boundary}`)) {
    const idx = /Content-ID:\s*<response-m(\d+)>/i.exec(part)?.[1];
    const status = Number(/HTTP\/1\.1 (\d{3})/.exec(part)?.[1]);
    if (idx === undefined || !status) continue;
    const id = ids[Number(idx)];
    if (!id) continue;
    if (status === 401) throw new GmailAuthError("Gmail rejected the token (401)");
    if (status === 404) {
      missing.push(id);
      answered.add(id);
      continue;
    }
    if (status !== 200) continue;
    const json = part.slice(part.indexOf("{"), part.lastIndexOf("}") + 1);
    try {
      messages.push(parse(JSON.parse(json)));
      answered.add(id);
    } catch {
      // not marked answered, so it gets retried next run
    }
  }
  return { messages, missing, failed: ids.filter((id) => !answered.has(id)) };
}

interface RawPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: RawPart[];
}

interface RawMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: RawPart & { headers?: { name: string; value: string }[] };
}

function toMessage(raw: RawMessage): GmailMessage {
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

function toBody(raw: RawMessage) {
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
