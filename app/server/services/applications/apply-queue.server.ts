import { jobSearches } from "~/lib/job-search";
import { keywordInText } from "../../cv/tailoring/keywords";
import type { Db } from "../../db/client.server";
import { savedJobs } from "../../db/queries/applications.server";
import { contactCounts } from "../../db/queries/contacts.server";
import { getCv, getProfile } from "../../db/queries/profile.server";
import { listRoleCvs } from "../../db/queries/role-cv.server";
import { tailoringByApplication } from "../../db/queries/tailored-cv.server";

const SEARCH_ROLES = 3;
const FIT_SKILLS_SHOWN = 8;

export async function applyQueue(db: Db, userId: string) {
  const [jobs, cv, profile, roleCvs, tailoring, contacts] = await Promise.all([
    savedJobs(db, userId),
    getCv(db, userId),
    getProfile(db, userId),
    listRoleCvs(db, userId),
    tailoringByApplication(db, userId),
    contactCounts(db, userId),
  ]);
  const skills = [...new Set(cv.skills.flatMap((group) => group.items))];
  const letters = new Map(tailoring.map((row) => [row.applicationId, Number(row.letterParagraphs) > 0]));
  const people = new Map(contacts.map((row) => [row.applicationId, Number(row.count)]));
  const roles = [...new Set([...cv.targetRoles, ...roleCvs.map((role) => role.title)].map((role) => role.trim()).filter(Boolean))];

  return {
    jobs: jobs.map(({ description, ...job }) => {
      const matched = description ? skills.filter((skill) => keywordInText(skill, description)) : [];
      return {
        ...job,
        fit: description && skills.length ? { matched: matched.slice(0, FIT_SKILLS_SHOWN), count: matched.length } : null,
        tailored: letters.has(job.id),
        letter: letters.get(job.id) ?? false,
        people: people.get(job.id) ?? 0,
      };
    }),
    searches: jobSearches(roles.slice(0, SEARCH_ROLES), profile.personal.address.city ?? ""),
  };
}
