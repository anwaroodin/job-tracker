import { data } from "react-router";
import type { Route } from "./+types/tailor";
import { cvContent } from "~/lib/cv";
import { getSession } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { obj } from "~/server/cv/clean";
import { storedResearch } from "~/server/cv/research";
import { jobKeywordsJson, storedJobKeywords } from "~/server/cv/tailoring/cache";
import { cleanState, continueTailoring, isStrategy, startTailoring, type Stage, type TailorContext } from "~/server/cv/tailoring/pipeline";
import { getDb } from "~/server/db/client.server";
import { getApplication, saveJdKeywords } from "~/server/db/queries/applications.server";
import { getCv } from "~/server/db/queries/profile.server";
import { insertTailoredCv, latestTailoredCv } from "~/server/db/queries/tailored-cv.server";

const STAGES = new Set<Stage>(["keywords", "plan", "diffs", "inject", "emphasis", "letter"]);
const MAX_BODY_CHARS = 400_000;

function parsed(text: string) {
  try {
    const body = obj(JSON.parse(text));
    return { applicationId: body.applicationId, stage: body.stage, result: body.result, state: body.state, strategy: body.strategy };
  } catch {
    return null;
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) throw data({ error: "not_authenticated" }, { status: 401 });
  const userId = session.user.id;

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw data({ error: "too_large" }, { status: 413 });
  const body = parsed(text);
  if (!body) throw data({ error: "invalid_json" }, { status: 400 });

  const db = getDb(env.DB);
  const [row, cv] = await Promise.all([getApplication(db, userId, String(body.applicationId ?? "")), getCv(db, userId)]);
  if (!row?.description) throw data({ error: "no_job_description" }, { status: 400 });

  const master = cvContent(cv);
  if (!master.experience.length && !master.summary) throw data({ error: "no_cv" }, { status: 400 });
  const ctx: TailorContext = {
    master,
    jobDescription: row.description,
    keywords: await storedJobKeywords(row),
    research: storedResearch(row.researchJson),
  };

  if (!body.stage) return startTailoring(ctx, isStrategy(body.strategy) ? body.strategy : "keywords");
  if (!STAGES.has(body.stage as Stage)) throw data({ error: "invalid_stage" }, { status: 400 });

  const state = cleanState(body.state);
  const step = continueTailoring(ctx, body.stage as Stage, body.result, state);

  if ("keywords" in step) {
    await saveJdKeywords(db, userId, row.id, await jobKeywordsJson(row.description, step.keywords));
    return startTailoring({ ...ctx, keywords: step.keywords }, state.strategy);
  }
  if ("done" in step) {
    const latest = await latestTailoredCv(db, userId, row.id);
    await insertTailoredCv(db, userId, row.id, (latest?.version ?? 0) + 1, step.done);
    return { done: true };
  }
  return step;
}
