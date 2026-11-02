export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailThreadUrl(accountEmail: string, threadId: string) {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}#all/${threadId}`;
}

export function gmailComposeUrl(accountEmail: string, draft: { to: string; subject: string; body: string }) {
  const params = new URLSearchParams({ authuser: accountEmail, view: "cm", fs: "1", to: draft.to, su: draft.subject, body: draft.body });
  return `https://mail.google.com/mail/?${params}`;
}
