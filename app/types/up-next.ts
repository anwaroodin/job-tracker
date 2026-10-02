export interface UpNextItem {
  emailId: string;
  applicationId: string;
  company: string;
  role: string;
  category: string;
  subject: string;
  receivedAt: string;
  eventAt: string | null;
  replyNeeded: number;
}

export interface UpNext {
  replies: UpNextItem[];
  upcoming: UpNextItem[];
}
