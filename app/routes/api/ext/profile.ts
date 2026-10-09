import type { Route } from "./+types/profile";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { allSkills } from "~/lib/cv";
import { getCv, getProfile } from "~/server/db/queries/profile.server";
import { extUser, guarded, json, preflight } from "~/server/extension/http.server";

/** GET /api/ext/profile: the profile the extension fills application forms from. */
export const loader = (args: Route.LoaderArgs) => guarded(args.request, () => profile(args));

async function profile({ request, context }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user) return json(request, { error: "not_authenticated" }, { status: 401 });
  const db = getDb(env.DB);
  const [form, cv] = await Promise.all([getProfile(db, user.id), getCv(db, user.id)]);
  const variant = {
    summary: cv.summaries[0]?.text ?? "",
    skills: allSkills(cv).join(", "),
    coverLetter: "",
    salary: form.eligibility.salary,
  };
  return json(request, { ...form, softwareCV: variant, retailCV: variant });
}
