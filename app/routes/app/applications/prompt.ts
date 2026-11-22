import { data } from "react-router";
import type { Route } from "./+types/prompt";
import { aiPrompt } from "~/lib/ai-prompt";
import { cvContent } from "~/lib/cv";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication } from "~/server/db/queries/applications.server";
import { getCv, getProfile } from "~/server/db/queries/profile.server";
import { latestTailoredCv } from "~/server/db/queries/tailored-cv.server";

export async function loader({ context, params }: Route.LoaderArgs) {
  const db = getDb(context.get(envContext).DB);
  const user = context.get(userContext);
  const [job, cv, profile, tailored] = await Promise.all([
    getApplication(db, user.id, params.id),
    getCv(db, user.id),
    getProfile(db, user.id),
    latestTailoredCv(db, user.id, params.id),
  ]);
  if (!job) throw data({ error: "not_found" }, { status: 404 });
  const name = [profile.personal.firstName, profile.personal.lastName].filter(Boolean).join(" ") || user.name || "";
  const prompt = aiPrompt({ job, cv: tailored?.cv ?? cvContent(cv), tailored: Boolean(tailored), confirmed: cv.confirmed, name, eligibility: profile.eligibility });
  return Response.json({ prompt }, { headers: { "Cache-Control": "private, no-store" } });
}
