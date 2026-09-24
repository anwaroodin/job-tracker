export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailMessageUrl(accountEmail: string, messageId: string) {
  return `https://mail.google.com/mail/u/${encodeURIComponent(accountEmail)}/#all/${messageId}`;
}
