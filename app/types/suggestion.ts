export interface Suggestion {
  key: string;
  company: string;
  role: string;
  appliedAt: string;
  lastReceivedAt: string;
  emailIds: string[];
  latestThreadId: string;
  category: string;
  subject: string;
  from: string;
  existing: { id: string; company: string; role: string } | null;
}
