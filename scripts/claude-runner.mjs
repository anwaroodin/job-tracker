import { spawn } from "node:child_process";
import { createServer } from "node:http";

const PORT = Number(process.env.RUNNER_PORT) || 4317;
const TIMEOUT_MS = 10 * 60 * 1000;
const MODEL = process.env.RUNNER_MODEL || "opus";
const WEB_TOOLS = ["WebSearch", "WebFetch"];
const MODEL_NAME = /^[a-z0-9.\-[\]]{2,60}$/i;
const EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const ORIGINS = new Set(["http://localhost:5173", process.env.JOB_TRACKER_URL?.replace(/\/$/, "")].filter(Boolean));

let busy = false;

const percent = (window) => (typeof window?.utilization === "number" ? Math.round(window.utilization * 100) : null);

function usageOf(reply, windows) {
  const u = reply.usage ?? {};
  return {
    costUsd: reply.total_cost_usd ?? 0,
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    fiveHour: percent(windows?.five_hour),
    sevenDay: percent(windows?.seven_day),
  };
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
    "--output-format", "stream-json",
    "--verbose",
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
        const events = out.split("\n").flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        });
        const reply = events.findLast((e) => e.type === "result");
        const windows = events.findLast((e) => e.type === "rate_limit_event")?.rate_limit_info?.unifiedWindows;
        if (!reply || reply.is_error || !reply.structured_output) throw new Error(reply?.result || "Claude returned no result");
        resolve({ result: reply.structured_output, usage: usageOf(reply, windows) });
      } catch (e) {
        reject(new Error(code ? `claude exited with ${code}: ${err.trim() || out.trim()}` : e.message));
      }
    });
    child.stdin.end(input);
  });
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
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, busy, model: MODEL });
  if (req.method !== "POST" || req.url !== "/run") return send(404, { error: "Not found" });
  if (busy) return send(409, { error: "Already tailoring something. Try again when it's done." });

  busy = true;
  const started = Date.now();
  try {
    const request = await readJson(req);
    console.log(`Running ${request.web ? "research" : "tailoring"} with ${MODEL_NAME.test(request.model ?? "") ? request.model : MODEL} (${request.effort ?? "default"} effort)…`);
    const { result, usage } = await runClaude(request);
    console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s, $${usage.costUsd.toFixed(3)} at API prices, 5-hour ${usage.fiveHour}%, week ${usage.sevenDay}%`);
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
});
