import { data } from "react-router";
import type { Route } from "./+types/tailor";
import { cvContent } from "~/lib/cv";
import { getSession } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanConfirmations, obj } from "~/server/cv/clean";
import { storedResearch } from "~/server/cv/research";
import { jobKeywordsJson, storedJobKeywords } from "~/server/cv/tailoring/cache";
import { cleanState, continueTailoring, isStrategy, startTailoring, type Stage, type TailorContext } from "~/server/cv/tailoring/pipeline";
import type { Strategy } from "~/server/cv/tailoring/prompts";
import { gapsRequest, skillGaps, sortGaps, withAnswers } from "~/server/cv/tailoring/questions";
import { getDb } from "~/server/db/client.server";
import { getApplication, saveJdKeywords } from "~/server/db/queries/applications.server";
import { getCv, saveCv } from "~/server/db/queries/profile.server";
import { insertTailoredCv, latestTailoredCv } from "~/server/db/queries/tailored-cv.server";

const STAGES = new Set<Stage>(["keywords", "plan", "diffs", "inject", "emphasis", "letter"]);
const MAX_BODY_CHARS = 400_000;

function parsed(text: string) {
  try {
    const body = obj(JSON.parse(text));
    return {
      applicationId: body.applicationId,
      stage: body.stage,
      result: body.result,
      state: body.state,
      strategy: body.strategy,
      answered: body.answered === true,
      answers: cleanConfirmations(body.answers),
    };
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
  const [row, saved] = await Promise.all([getApplication(db, userId, String(body.applicationId ?? "")), getCv(db, userId)]);
  if (!row?.description) throw data({ error: "no_job_description" }, { status: 400 });
  const cv = body.answers.length ? { ...saved, confirmed: withAnswers(saved.confirmed, body.answers) } : saved;
  if (body.answers.length) await saveCv(db, userId, cv);

  const master = cvContent(cv);
  if (!master.experience.length && !master.summary) throw data({ error: "no_cv" }, { status: 400 });
  const ctx: TailorContext = {
    master,
    jobDescription: row.description,
    keywords: await storedJobKeywords(row),
    research: storedResearch(row.researchJson),
    confirmed: cv.confirmed,
  };
  const begin = (c: TailorContext, strategy: Strategy) => {
    const gaps = c.keywords && !body.answered ? skillGaps(c.keywords, master, c.confirmed) : [];
    return gaps.length ? { stage: "gaps", request: gapsRequest(gaps, master), state: { strategy } } : startTailoring(c, strategy);
  };

  if (!body.stage) return begin(ctx, isStrategy(body.strategy) ? body.strategy : "keywords");
  const state = cleanState(body.state);

  if (body.stage === "gaps") {
    const { implied, ask } = sortGaps(body.result, ctx.keywords ? skillGaps(ctx.keywords, master, cv.confirmed) : []);
    const confirmed = withAnswers(cv.confirmed, implied);
    if (implied.length) await saveCv(db, userId, { ...cv, confirmed });
    return ask.length ? { questions: ask } : startTailoring({ ...ctx, confirmed }, state.strategy);
  }
  if (!STAGES.has(body.stage as Stage)) throw data({ error: "invalid_stage" }, { status: 400 });

  const step = continueTailoring(ctx, body.stage as Stage, body.result, state);

  if ("keywords" in step) {
    await saveJdKeywords(db, userId, row.id, await jobKeywordsJson(row.description, step.keywords));
    return begin({ ...ctx, keywords: step.keywords }, state.strategy);
  }
  if ("done" in step) {
    const latest = await latestTailoredCv(db, userId, row.id);
    await insertTailoredCv(db, userId, row.id, (latest?.version ?? 0) + 1, step.done);
    return { done: true };
  }
  return step;
}
