import { observable } from "@legendapp/state";

export interface Milestone {
  id: number;
  applicationId: string;
  company: string;
  role: string;
  status: string;
}

export const milestone$ = observable<Milestone | null>(null);

export const celebrate = (m: Omit<Milestone, "id">) => milestone$.set({ ...m, id: Date.now() });
