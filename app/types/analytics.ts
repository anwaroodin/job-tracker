export interface Analytics {
  totals: {
    total: number;
    active: number;
    offers: number;
    rejected: number;
    responseRate: number; // % of apps that moved beyond `applied`
    weekly: number; // apps in the last 7 days
    previousWeekly: number; // apps in the 7 days before that
    streakDays: number; // days since the most recent application
  };
  byStatus: { status: string; count: number }[];
  byCv: { cvType: string; count: number }[];
  weekly: { weekLabel: string; weekStart: string; count: number }[];
  funnel: { stage: string; count: number }[];
  topCompanies: { company: string; count: number }[];
  recent: { id: string; company: string; role: string; status: string; appliedAt: string }[];
}
