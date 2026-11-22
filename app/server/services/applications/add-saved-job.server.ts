import { cleanUrl } from "../../extension/input.server";
import type { Db } from "../../db/client.server";
import { createApplication } from "../../db/queries/applications.server";
import { readJobDescription } from "./job-pdf.server";

const MAX_DESCRIPTION = 20_000;
const MAX_FIELD = 200;

const field = (form: FormData, name: string, max = MAX_FIELD) => String(form.get(name) ?? "").trim().slice(0, max);

export async function addSavedJob(env: Env, db: Db, userId: string, form: FormData) {
  const description = field(form, "description", MAX_DESCRIPTION);
  const url = cleanUrl(field(form, "url", 1000));
  const read = description ? await readJobDescription(env, db, userId, description) : null;
  const job = read && "job" in read ? read.job : null;
  const company = field(form, "company") || job?.company.slice(0, MAX_FIELD) || "";
  const role = field(form, "role") || job?.role.slice(0, MAX_FIELD) || "";

  if (!description && !url) return { error: "Paste the job description or a link." };
  if (!company || !role) {
    return { error: `Couldn't find the ${company ? "role" : role ? "company" : "company or role"}. Fill it in and add again.`, job: { company, role, url } };
  }

  await createApplication(db, {
    id: crypto.randomUUID(),
    userId,
    company,
    role,
    url,
    status: "saved",
    starred: true,
    autoFilled: false,
    description: job?.description.slice(0, MAX_DESCRIPTION) ?? description,
    location: job?.location ?? "",
    salary: job?.salary ?? "",
    workType: job?.workType ?? "",
    employmentType: job?.employmentType ?? "",
  });
  return { added: `${role} at ${company}` };
}
