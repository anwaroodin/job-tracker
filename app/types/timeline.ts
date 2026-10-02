export interface TimelineEmail {
  id: string;
  threadId: string | null;
  viewedAt: string | null;
  dismissedAt: string | null;
  category: string | null;
  eventAt: string | null;
  eventText: string | null;
  actionUrl: string | null;
  actionText: string | null;
  subject: string | null;
  snippet: string | null;
  fromName: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  needsReply: boolean;
  unsure: boolean;
  confirmed: boolean;
  edited: boolean;
}
