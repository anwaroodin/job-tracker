export interface SearchApplicationItem {
  id: string;
  company: string;
  role: string;
  location: string;
  status: string;
  appliedAt: string;
  updatedAt?: string;
  starred: boolean;
}

export interface SearchEmailItem {
  id: string;
  subject: string;
  fromAddress: string;
  snippet: string;
  receivedAt: string;
  category: string;
  applicationId: string;
  company: string;
  role: string;
}

export interface SearchResults {
  applications: SearchApplicationItem[];
  emails: SearchEmailItem[];
}
