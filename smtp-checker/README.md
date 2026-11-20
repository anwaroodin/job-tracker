# SMTP checker

Checks whether a mail server would accept an address (`RCPT TO`), without sending anything. Cloudflare Workers can't open port 25, so this runs on a VPS or your own PC, and the Worker calls it over HTTPS (`app/server/outreach/smtp-check.server.ts`).

Plain Node 22+, no dependencies. The same code runs in both places. Only the `.env` and how it's reached differ.

## API

Every request needs `Authorization: Bearer <CHECKER_SECRET>`.

- `POST /check` with `{ "email": "jane.smith@acme.com" }` returns `{ "status", "detail" }`
- `GET /health` returns today's usage

| status | meaning |
| --- | --- |
| `valid` | Accepted, and a random address at the domain was refused |
| `accept_all` | The domain accepts every address, so this proves nothing |
| `not_found` | The server says the mailbox doesn't exist, or the domain has no mail server |
| `blocked` | The server refused to talk to us (blocklist, policy). Not the same as not found |
| `unknown` | Timeout, greylisting, or anything else |

Checks run one at a time with a gap between them (`GAP_MS`), capped per day (`DAILY_LIMIT`), to protect the IP's reputation.

## Setup

1. Check that outbound port 25 is open: `nc -vz -w 5 gmail-smtp-in.l.google.com 25`. If it times out, the host blocks it. Ask the provider, or use another host.
2. Copy `.env.example` to `.env` and set `CHECKER_SECRET` (`openssl rand -hex 32`). Set `HELO_NAME` to a hostname whose reverse DNS points back at this machine's IP. That matters on a VPS. A home IP has no proper reverse DNS, so leave `HELO_NAME` empty there. Always set `MAIL_FROM` to an address on a real domain you own. Many servers refuse a sender domain that doesn't resolve, and that shows up as `blocked`.
3. Run it: `npm run smtp-checker` from the repo, or `node --env-file=.env server.mjs` from this folder.
4. Expose it with a Cloudflare Tunnel so no port is opened to the internet: `cloudflared tunnel --url http://127.0.0.1:4318` for a quick test, or a named tunnel with a route like `smtp.<your-domain>` to keep it permanent.
5. On the Worker, set `SMTP_CHECKER_URL` (the tunnel URL) and `SMTP_CHECKER_SECRET` with `wrangler secret put`, or in `.dev.vars` for local dev.

### On a VPS

Copy this folder over and keep it running with systemd:

```ini
# /etc/systemd/system/smtp-checker.service
[Unit]
Description=SMTP checker
After=network-online.target

[Service]
WorkingDirectory=/opt/smtp-checker
ExecStart=/usr/bin/node --env-file=.env server.mjs
Restart=always
User=nobody

[Install]
WantedBy=multi-user.target
```

`systemctl enable --now smtp-checker`, then install `cloudflared` as a service the same way (`cloudflared service install <token>`).

### On your PC

`npm run smtp-checker` plus `cloudflared`. Connect directly, not through Tor or any proxy: Tor exits block port 25, and mail servers reject their IPs. Checks always go out over IPv4, because mail servers reject IPv6 senders without reverse DNS, and home IPv6 addresses don't have it. Expect Microsoft 365 domains to come back `blocked` from a home IP. While the PC is off, the Worker gets `null` and falls back to pattern-only results.

## Tests

`node --test smtp-checker/`
