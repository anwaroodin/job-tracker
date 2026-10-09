import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const PORT = Number(process.env.RUNNER_PORT) || 4317;
const TIMEOUT_MS = 10 * 60 * 1000;
const MODEL = process.env.RUNNER_MODEL || "opus";
const WEB_TOOLS = ["WebSearch", "WebFetch"];
const MODEL_NAME = /^[a-z0-9.\-[\]]{2,60}$/i;
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const AGY_MODEL = process.env.ANTIGRAVITY_MODEL || "gemini-3.8-flash";
const AGY_LEVEL = { low: "low", medium: "medium", high: "high", xhigh: "high", max: "high" };
const run = promisify(execFile);
const ANTIGRAVITY = process.env.RUNNER_ANTIGRAVITY !== "0" && (await run("which", ["agy"]).then(() => true, () => false));
const ORIGINS = new Set(["http://localhost:5173", process.env.JOB_TRACKER_URL?.replace(/\/$/, "")].filter(Boolean));

let busy = false;

function usageOf(reply) {
  const u = reply.usage ?? {};
  return {
    costUsd: reply.total_cost_usd ?? 0,
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    cachedTokens: u.cache_read_input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
  };
}

async function claudeToken() {
  const stored =
    process.platform === "darwin"
      ? (await run("security", ["find-generic-password", "-s", "Claude Code-credentials", "-w"])).stdout
      : await readFile(join(homedir(), ".claude", ".credentials.json"), "utf8");
  return JSON.parse(stored).claudeAiOauth.accessToken;
}

async function planUsage() {
  const res = await fetch(USAGE_URL, {
    headers: { Authorization: `Bearer ${await claudeToken()}`, "anthropic-beta": "oauth-2025-04-20" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Usage request failed (${res.status})`);
  const body = await res.json();
  return { fiveHour: body.five_hour?.utilization ?? null, sevenDay: body.seven_day?.utilization ?? null };
}

function runClaude({ system, schema, input, model, effort, web }) {
  const tools = web ? ["--tools", WEB_TOOLS.join(","), "--allowedTools", ...WEB_TOOLS] : ["--tools", ""];
  const args = [
    "-p",
    "--model", MODEL_NAME.test(model ?? "") ? model : MODEL,
    ...tools,
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    ...(EFFORTS.has(effort) ? ["--effort", effort] : []),
    "--output-format", "json",
    "--system-prompt", system,
    "--json-schema", JSON.stringify(schema),
  ];
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"], timeout: TIMEOUT_MS });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        const reply = JSON.parse(out);
        if (reply.is_error || !reply.structured_output) throw new Error(reply.result || "Claude returned no result");
        resolve({ result: reply.structured_output, usage: usageOf(reply) });
      } catch (e) {
        reject(new Error(code ? `claude exited with ${code}: ${err.trim() || out.trim()}` : e.message));
      }
    });
    child.stdin.end(input);
  });
}

async function runAntigravity({ system, schema, input, effort }) {
  const dir = await mkdtemp(join(tmpdir(), "job-tracker-agy-"));
  const args = [
    "--output-format", "json",
    "--json-schema", JSON.stringify(schema),
    "--model", `${AGY_MODEL}-${AGY_LEVEL[effort] ?? "medium"}`,
    "--sandbox",
    "--dangerously-skip-permissions",
    "--disable-slash-commands",
    "--print-timeout", `${TIMEOUT_MS / 1000}s`,
    "-p", `${system}\n\n${input}`,
  ];
  try {
    const { stdout, stderr } = await run("agy", args, { cwd: dir, timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 });
    const reply = JSON.parse(stdout);
    if (reply.status !== "SUCCESS" || !reply.structured_output) {
      const denied = (reply.denied_actions ?? []).map((a) => a.action).join(", ");
      throw new Error(`Antigravity returned no result${denied ? ` (denied: ${denied})` : ""}. ${stderr.trim() || reply.response || ""}`.trim());
    }
    const u = reply.usage ?? {};
    const usage = { costUsd: 0, inputTokens: u.input_tokens ?? 0, cachedTokens: u.cache_read_tokens ?? 0, outputTokens: (u.output_tokens ?? 0) + (u.thinking_tokens ?? 0) };
    return { result: reply.structured_output, usage };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (!ORIGINS.has(origin)) {
    res.writeHead(403).end();
    return;
  }
  const send = (status, body) =>
    res
      .writeHead(status, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Private-Network": "true",
        "Content-Type": "application/json",
        Vary: "Origin",
      })
      .end(body === undefined ? undefined : JSON.stringify(body));

  if (req.method === "OPTIONS") return send(204);
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, busy, model: MODEL, antigravity: ANTIGRAVITY });
  if (req.method === "GET" && req.url === "/usage") {
    return planUsage().then(
      (usage) => send(200, usage),
      (e) => send(503, { error: e.message }),
    );
  }
  if (req.method !== "POST" || req.url !== "/run") return send(404, { error: "Not found" });
  if (busy) return send(409, { error: "Already tailoring something. Try again when it's done." });

  busy = true;
  const started = Date.now();
  try {
    const request = await readJson(req);
    const onAntigravity = request.provider === "antigravity" && ANTIGRAVITY;
    const model = onAntigravity ? `Antigravity ${AGY_MODEL}` : MODEL_NAME.test(request.model ?? "") ? request.model : MODEL;
    console.log(`Running ${request.web ? "research" : "tailoring"} with ${model} (${request.effort ?? "default"} effort)…`);
    const { result, usage } = await (onAntigravity ? runAntigravity(request) : runClaude(request));
    console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: $${usage.costUsd.toFixed(3)} at API prices, ${usage.inputTokens} tokens in, ${usage.cachedTokens} cached, ${usage.outputTokens} out`);
    send(200, { result, usage });
  } catch (e) {
    console.error(e.message);
    send(500, { error: e.message });
  } finally {
    busy = false;
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Claude runner on http://127.0.0.1:${PORT}, accepting ${[...ORIGINS].join(", ")}. Set JOB_TRACKER_URL in .env to add the deployed app.`);
  console.log(ANTIGRAVITY ? `Reading steps and research run on Antigravity (${AGY_MODEL}).` : "Every step runs on Claude (Antigravity's agy CLI not found or turned off).");
});
