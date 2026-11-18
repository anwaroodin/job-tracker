import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { checkAddress } from "./smtp.mjs";

const PORT = Number(process.env.PORT) || 4318;
const HOST = process.env.HOST || "127.0.0.1";
const SECRET = process.env.CHECKER_SECRET ?? "";
const HELO_NAME = process.env.HELO_NAME || hostname();
const MAIL_FROM = process.env.MAIL_FROM || `verify@${HELO_NAME}`;
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT) || 200;
const GAP_BETWEEN_CHECKS_MS = Number(process.env.GAP_MS) || 3_000;
const MAX_BODY_BYTES = 1_024;
const EMAIL = /^[a-z0-9._%+-]{1,64}@(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

if (SECRET.length < 32) {
  console.error("Set CHECKER_SECRET to a random string of at least 32 characters (openssl rand -hex 32).");
  process.exit(1);
}

const usage = { day: today(), used: 0 };
let queue = Promise.resolve();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hasQuotaLeft() {
  if (usage.day !== today()) Object.assign(usage, { day: today(), used: 0 });
  return usage.used < DAILY_LIMIT;
}

function isAuthorized(req) {
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(req.headers.authorization ?? ""), digest(`Bearer ${SECRET}`));
}

function oneAtATime(task) {
  const run = queue.then(task);
  queue = run.catch(() => {}).then(() => sleep(GAP_BETWEEN_CHECKS_MS));
  return run;
}

async function readEmail(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY_BYTES) return null;
  }
  try {
    const email = String(JSON.parse(body).email ?? "").trim().toLowerCase();
    return EMAIL.test(email) ? email : null;
  } catch {
    return null;
  }
}

function reply(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

async function handle(req, res) {
  if (!isAuthorized(req)) return reply(res, 401, { error: "Unauthorized" });
  if (req.method === "GET" && req.url === "/health") return reply(res, 200, { ok: true, ...usage, limit: DAILY_LIMIT });
  if (req.method !== "POST" || req.url !== "/check") return reply(res, 404, { error: "Not found" });

  const email = await readEmail(req);
  if (!email) return reply(res, 400, { error: "Send { email } with a valid address" });
  if (!hasQuotaLeft()) return reply(res, 429, { error: "Daily check limit reached" });

  usage.used += 1;
  const result = await oneAtATime(() => checkAddress(email, { heloName: HELO_NAME, mailFrom: MAIL_FROM }));
  console.log(`${email.split("@")[1]} → ${result.status}`);
  reply(res, 200, result);
}

createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    reply(res, 500, { error: "Check failed" });
  });
}).listen(PORT, HOST, () => console.log(`SMTP checker on http://${HOST}:${PORT} as ${HELO_NAME}`));
