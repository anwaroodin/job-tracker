import { data } from "react-router";
import type { Route } from "./+types/runs";
import { getSession } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { obj } from "~/server/cv/clean";
import { getDb } from "~/server/db/client.server";
import { getRoleCv } from "~/server/db/queries/role-cv.server";
import { finishRun, insertRun, insertStage, runFor } from "~/server/db/queries/runner-runs.server";
import { latestTailoredCv } from "~/server/db/queries/tailored-cv.server";
import { runFinish, runId, runStage, runStart } from "~/server/runs/input.server";

const MAX_BODY_CHARS = 10_000;

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) throw data({ error: "not_authenticated" }, { status: 401 });
  const userId = session.user.id;
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw data({ error: "too_large" }, { status: 413 });
  let body: ReturnType<typeof obj>;
  try {
    body = obj(JSON.parse(text));
  } catch {
    throw data({ error: "invalid_json" }, { status: 400 });
  }
  const db = getDb(env.DB);

  if (body.action === "start") {
    const run = runStart(body.run, userId);
    if (!run) throw data({ error: "invalid_run" }, { status: 400 });
    await insertRun(db, run);
    return { ok: true };
  }

  const id = runId(body.runId);
  const run = id ? await runFor(db, userId, id) : undefined;
  if (!id || !run) throw data({ error: "unknown_run" }, { status: 404 });

  if (body.action === "stage") {
    await insertStage(db, runStage(body.stage, id));
    return { ok: true };
  }
  if (body.action === "finish") {
    const finish = runFinish(body.finish);
    const version =
      finish.status !== "done" || run.kind !== "tailor"
        ? null
        : run.applicationId
          ? ((await latestTailoredCv(db, userId, run.applicationId))?.version ?? null)
          : run.roleCvId
            ? ((await getRoleCv(db, userId, run.roleCvId))?.version ?? null)
            : null;
    await finishRun(db, userId, id, { ...finish, version });
    return { ok: true };
  }
  throw data({ error: "unknown_action" }, { status: 400 });
}
