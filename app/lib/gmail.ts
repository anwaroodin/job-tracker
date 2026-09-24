export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailThreadUrl(accountEmail: string, threadId: string) {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}#all/${threadId}`;
}
