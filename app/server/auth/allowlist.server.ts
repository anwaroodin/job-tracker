export function assertAllowed(env: Env, email: string) {
  const allowed = (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(email.toLowerCase())) {
    throw new Error("This email is not authorised to sign in");
  }
}
