import { type EmailStatus, isEmailStatus } from "~/lib/contacts";

const TIMEOUT_MS = 45_000;

export async function checkEmail(env: Env, email: string): Promise<EmailStatus | null> {
  if (!env.SMTP_CHECKER_URL || !env.SMTP_CHECKER_SECRET) return null;
  try {
    const res = await fetch(new URL("/check", env.SMTP_CHECKER_URL), {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SMTP_CHECKER_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: { status?: unknown } = await res.json();
    return isEmailStatus(body.status) ? body.status : null;
  } catch {
    return null;
  }
}
