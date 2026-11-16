import type { Application } from "~/server/db/schema";

export type { Application, NewApplication } from "~/server/db/schema";

/** What the Edit dialog on a saved or applied job can change. */
export type EditableDetails = Pick<Application, "company" | "role" | "url" | "location" | "workType" | "employmentType" | "salary" | "notes" | "description">;

export type ApplicationRowData = Omit<Application, "description" | "notes" | "contactsJson" | "jdKeywordsJson" | "researchJson" | "prepJson"> & { unread?: number; tailored?: boolean };

export type SavedJobData = Pick<Application, "id" | "company" | "role"> & {
  logoUrl?: string | null;
  url?: string | null;
  location?: string | null;
  starred?: boolean | null;
  appliedAt?: string | null;
  status?: string | null;
  unread?: number;
  tailored?: boolean;
};

