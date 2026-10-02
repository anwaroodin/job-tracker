import { toBody, toMessage, type EmailBody, type RawMessage } from "./mapping.server";

const API = "https://gmail.googleapis.com";
const BATCH_SIZE = 50;
const BATCH_GAP_MS = 1100;

export class GmailAuthError extends Error {}

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
