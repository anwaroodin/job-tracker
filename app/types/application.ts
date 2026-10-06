import type { Application } from "~/server/db/schema";

export type { Application, NewApplication } from "~/server/db/schema";

export type ApplicationRowData = Application & { unread?: number };

export type SavedJobData = Pick<Application, "id" | "company" | "role"> & {
  logoUrl?: string | null;
  url?: string | null;
  location?: string | null;
  starred?: boolean | null;
  appliedAt?: string | null;
  status?: string | null;
  unread?: number;
};

export type SavedListingJob = Pick<
  Application,
  | "id"
  | "company"
  | "role"
  | "url"
  | "status"
  | "starred"
  | "location"
  | "workType"
  | "employmentType"
  | "salary"
  | "postedAt"
  | "applicants"
  | "logoUrl"
  | "contactsJson"
  | "cvType"
  | "category"
  | "description"
  | "appliedAt"
>;
