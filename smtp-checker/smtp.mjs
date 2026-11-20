import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { connect } from "node:net";

const SMTP_PORT = 25;
const TIMEOUT_MS = 15_000;
const MAX_MX_HOSTS = 2;
const UNKNOWN_USER = /\b5\.1\.[0-3]\b/;
const BLOCKED = /\b5\.7\.\d+\b|block|spamhaus|blacklist|reputation|policy|denied|banned|rbl\b/i;

export function classifyReply({ code, text }) {
  if (code === 250 || code === 251) return "accepted";
  if (code < 500) return "unknown";
  if (UNKNOWN_USER.test(text)) return "rejected";
  if (BLOCKED.test(text)) return "blocked";
  return "rejected";
}

export function verdict(target, probe) {
  if (target === "rejected") return "not_found";
  if (target !== "accepted") return target;
  if (probe === "rejected") return "valid";
  if (probe === "accepted") return "accept_all";
  return "unknown";
}

export async function checkAddress(email, { heloName, mailFrom }) {
  const domain = email.split("@")[1];
  const hosts = await mailHosts(domain);
  if (hosts.length === 0) return { status: "not_found", detail: "Domain has no mail server" };

  let lastError;
  for (const host of hosts.slice(0, MAX_MX_HOSTS)) {
    try {
      return await converse(host, email, domain, { heloName, mailFrom });
    } catch (error) {
      lastError = error;
    }
  }
  return { status: "unknown", detail: lastError.message };
}

async function mailHosts(domain) {
  try {
    const records = await dns.resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority).map((record) => record.exchange);
  } catch (error) {
    if (error.code === "ENODATA") return [domain];
    if (error.code === "ENOTFOUND") return [];
    throw error;
  }
}

async function converse(host, email, domain, { heloName, mailFrom }) {
  const smtp = await openSession(host);
  try {
    const setup = [() => smtp.read(), () => smtp.send(`EHLO ${heloName}`), () => smtp.send(`MAIL FROM:<${mailFrom}>`)];
    for (const step of setup) {
      const reply = await step();
      if (reply.code >= 400) return { status: reply.code >= 500 ? "blocked" : "unknown", detail: reply.text };
    }

    const target = await smtp.send(`RCPT TO:<${email}>`);
    const targetResult = classifyReply(target);
    if (targetResult !== "accepted") return { status: verdict(targetResult), detail: target.text };

    const probe = await smtp.send(`RCPT TO:<${randomBytes(8).toString("hex")}@${domain}>`);
    return { status: verdict(targetResult, classifyReply(probe)), detail: target.text };
  } finally {
    smtp.close();
  }
}

function openSession(host) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: SMTP_PORT, family: 4 });
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error(`Timed out talking to ${host}`)));
    socket.once("error", reject);
    socket.once("connect", () => {
      socket.off("error", reject);
      resolve(replyReader(socket));
    });
  });
}

function replyReader(socket) {
  const replies = [];
  const lines = [];
  let buffer = "";
  let waiting = null;
  let failure = null;

  const settle = () => {
    if (!waiting) return;
    const { resolve, reject } = waiting;
    if (replies.length > 0) resolve(replies.shift());
    else if (failure) reject(failure);
    else return;
    waiting = null;
  };

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      lines.push(line);
      const isLastLine = line[3] !== "-";
      if (isLastLine) replies.push({ code: Number(line.slice(0, 3)), text: lines.splice(0).join("\n") });
    }
    settle();
  });
  socket.on("error", (error) => {
    failure = error;
    settle();
  });
  socket.on("close", () => {
    failure ??= new Error("Mail server closed the connection");
    settle();
  });

  const read = () =>
    new Promise((resolve, reject) => {
      waiting = { resolve, reject };
      settle();
    });

  return {
    read,
    send(command) {
      socket.write(`${command}\r\n`);
      return read();
    },
    close() {
      if (!socket.destroyed) socket.end("QUIT\r\n");
    },
  };
}
