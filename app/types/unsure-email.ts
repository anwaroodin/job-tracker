export interface UnsureEmail {
  id: string;
  threadId: string | null;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
}
