import { cleanContacts } from "~/lib/contacts";
import { hiringManagerTitles, RECRUITER_TITLES } from "~/lib/outreach";
import type { Db } from "../../db/client.server";
import { getApplication } from "../../db/queries/applications.server";
import { clearUnusedSearchResults, saveContacts, saveFoundPeople } from "../../db/queries/contacts.server";
import { recordOutreachUsage } from "../../db/queries/outreach-usage.server";
import { braveFindProfiles } from "../../outreach/brave.server";
import { generectSearchPeople } from "../../outreach/generect.server";
import { BRAVE_COST_PER_SEARCH, canSpend } from "./budget.server";

const PER_GROUP = 3;

async function searchLinkedInProfiles(env: Env, db: Db, userId: string, applicationId: string, company: string, role: string) {
  if (!env.BRAVE_SEARCH_API_KEY || !(await canSpend(env, db, "brave"))) return { reached: false, saved: 0 };
  const groups = await Promise.all([
    braveFindProfiles(env, company, hiringManagerTitles(role)),
    braveFindProfiles(env, company, RECRUITER_TITLES),
  ]);
  const profiles = cleanContacts(groups.flatMap((group) => group?.slice(0, PER_GROUP) ?? []));
  const answered = groups.filter((group) => group !== null);
  if (answered.length) {
    await recordOutreachUsage(db, userId, answered.map((group) => ({ provider: "brave", action: "find-people", found: group.length, costUsd: BRAVE_COST_PER_SEARCH })));
    await clearUnusedSearchResults(db, userId, applicationId);
  }
  if (profiles.length) await saveContacts(db, userId, applicationId, profiles, "search");
  return { reached: answered.length > 0, saved: profiles.length };
}

async function searchPeopleDatabase(env: Env, db: Db, userId: string, applicationId: string, company: string, role: string) {
  const groups = await Promise.all([
    generectSearchPeople(env, company, hiringManagerTitles(role), PER_GROUP),
    generectSearchPeople(env, company, RECRUITER_TITLES, PER_GROUP),
  ]);
  const answered = groups.filter((group) => group !== null);
  const people = answered.flatMap((group) => group.leads);
  if (answered.length) {
    await recordOutreachUsage(db, userId, answered.map((group) => ({ provider: "generect", action: "find-people", ...group.charge })));
    await clearUnusedSearchResults(db, userId, applicationId);
  }
  if (people.length) await saveFoundPeople(db, userId, applicationId, people);
  return { reached: answered.length > 0, saved: people.length };
}

export async function findPeople(env: Env, db: Db, userId: string, applicationId: string) {
  const row = await getApplication(db, userId, applicationId);
  if (!row) return { error: "This application doesn't exist any more." };
  if (!env.BRAVE_SEARCH_API_KEY && !env.GENERECT_API_KEY) return { error: "People search isn't set up. Add a Brave Search or Generect API key." };

  let reached = false;
  for (const run of [searchLinkedInProfiles, searchPeopleDatabase]) {
    const result = await run(env, db, userId, applicationId, row.company, row.role);
    if (result.saved) return { ok: true };
    reached ||= result.reached;
  }
  if (!reached) return { error: "Couldn't reach the people search. Try again in a moment." };
  return { notice: `No recruiters or hiring managers found at ${row.company}. Try searching LinkedIn below.` };
}
