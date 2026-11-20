import { data, Link } from "react-router";
import type { Route } from "./+types/cv";
import { ScoreView } from "~/components/tailored-cv/score";
import { TailoredTabs } from "~/components/tailored-cv/tailored-tabs";
import { TailorPanel } from "~/components/tailored-cv/tailor-panel";
import { SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock } from "~/components/ui/side-block";
import { shortDate, stagger, PageTitle } from "~/components/ui/terminal";
import { cvContent, personFor } from "~/lib/cv";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanResearch, researchRequest, storedResearch } from "~/server/cv/research";
import { applyEdits } from "~/server/cv/tailored";
import { storedJobKeywords } from "~/server/cv/tailoring/cache";
import { atsScore } from "~/server/cv/tailoring/keywords";
import { revertChange } from "~/server/cv/tailoring/resume";
import { evidenceText, impliedTerms, scoreBefore } from "~/server/cv/tailoring/questions";
import { getDb } from "~/server/db/client.server";
import { jsonField } from "~/server/form.server";
import { getApplication, saveResearch } from "~/server/db/queries/applications.server";
import { getCv, getCvDesign, getProfile } from "~/server/db/queries/profile.server";
import { insertTailoredCv, latestTailoredCv } from "~/server/db/queries/tailored-cv.server";
import type { AtsScore, TailoredCv } from "~/types/cv";

export const handle = { title: () => "Tailored CV" };

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [row, cv, profile, tailored, design] = await Promise.all([
    getApplication(db, user.id, params.id),
    getCv(db, user.id),
    getProfile(db, user.id),
    latestTailoredCv(db, user.id, params.id),
    getCvDesign(db, user.id),
  ]);
  if (!row) throw data("Not found", { status: 404 });

  const keywords = await storedJobKeywords(row);
  const master = cvContent(cv);
  const hasCv = cv.experience.length > 0 || cv.summaries.length > 0;
  const score: { before: AtsScore; after?: AtsScore } | null = tailored?.cv.score ?? (keywords ? { before: scoreBefore(master, cv.confirmed, keywords) } : null);
  return {
    application: { id: row.id, company: row.company, role: row.role, description: row.description },
    canTailor: hasCv && !!row.description,
    researchRequest: row.description ? researchRequest(row) : null,
    research: storedResearch(row.researchJson),
    hasCv,
    hasDescription: !!row.description,
    score,
    person: personFor(profile.personal, user),
    design,
    tailored,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const form = await request.formData();
  const intent = form.get("intent");

  const [row, cv, latest] = await Promise.all([
    getApplication(db, user.id, params.id),
    getCv(db, user.id),
    latestTailoredCv(db, user.id, params.id),
  ]);
  if (!row) throw data("Not found", { status: 404 });

  if (intent === "research") {
    await saveResearch(db, user.id, row.id, JSON.stringify(cleanResearch(jsonField(form, "result", "{}"))));
    return { ok: true };
  }

  if ((intent !== "edit" && intent !== "revert") || !latest) throw data("Unknown action", { status: 400 });
  const saveVersion = async (edited: TailoredCv) => {
    const keywords = await storedJobKeywords(row);
    if (keywords && edited.score) edited.score = { ...edited.score, after: atsScore(edited, keywords, evidenceText(cvContent(cv), cv.confirmed), impliedTerms(cv.confirmed)) };
    await insertTailoredCv(db, user.id, row.id, latest.version + 1, edited);
    return { ok: true };
  };

  if (intent === "edit") return saveVersion(applyEdits(latest.cv, jsonField(form, "cv", "{}")));
  const index = Number(form.get("index"));
  const change = latest.cv.edits?.[index];
  const reverted = change && revertChange(latest.cv, change);
  if (!reverted) return { error: "This line has been edited since, so it can't be put back automatically. Change it in Edit." };
  return saveVersion({ ...reverted, edits: latest.cv.edits?.filter((_, i) => i !== index) });
}

export default function TailoredCvPage({ loaderData }: Route.ComponentProps) {
  const { application, canTailor, researchRequest, research, hasCv, hasDescription, score, person, design, tailored } = loaderData;

  return (
    <div className={`flex flex-col gap-8 ${SANS_PAGE}`}>
      <header className="rise" style={stagger(0)}>
        <PageTitle title="Tailored CV" sub={`${application.role} · ${application.company}`} />
      </header>

      <div className="rise" style={stagger(1)}>
        {canTailor ? (
          <TailorPanel
            target={{ applicationId: application.id }}
            company={application.company}
            role={application.role}
            research={researchRequest}
            hasResearch={!!research}
            retailor={!!tailored}
          />
        ) : (
          <div className="border border-stroke-secondary px-6 py-10 text-center">
            <p className="font-medium text-text-primary">{!hasCv ? "Add your CV first" : "No job description yet"}</p>
            <p className="mt-1 text-[13px] text-text-tertiary">
              {!hasCv ? (
                <>
                  Tailoring rewrites your master CV for this job.{" "}
                  <Link to="/cv?edit" className="text-text-primary underline underline-offset-4">
                    Add your experience
                  </Link>
                  , then come back.
                </>
              ) : (
                !hasDescription && "Open the posting and save it with the extension, or paste it in Edit details on the application."
              )}
            </p>
          </div>
        )}
      </div>

      <div className="rise grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12" style={stagger(2)}>
        <div className="flex min-w-0 flex-col gap-10">
          <TailoredTabs
            cv={tailored?.cv ?? null}
            person={person}
            design={design}
            filename={`${person.name || "CV"} - ${application.company} CV.pdf`}
            score={score}
            description={application.description}
            research={research}
            company={application.company}
          />
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">
          {score && (
            <SideBlock title="Match score" aside={score.after ? "After tailoring" : "Your CV as it is"}>
              <ScoreView before={score.before} after={score.after} />
            </SideBlock>
          )}
          <SideBlock title="This CV">
            <p className="text-[13.5px] text-text-secondary">
              {tailored ? `Version ${tailored.version}${tailored.cv.pipeline ? ` (${tailored.cv.pipeline})` : ""} · tailored ${shortDate(tailored.createdAt)}` : "Not tailored yet"}
            </p>
            <Link to={`/applications/${application.id}`} className="text-[13px] text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              Back to the application
            </Link>
          </SideBlock>
        </aside>
      </div>
    </div>
  );
}
