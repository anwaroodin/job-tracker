import { data, Link } from "react-router";
import type { Route } from "./+types/prep";
import { PrepareBlock, PrepList, PrepQuestions } from "~/components/application-detail/interview-prep";
import { ResearchView } from "~/components/application-detail/research";
import { CompanyLogo } from "~/components/applications/company-logo";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock } from "~/components/ui/side-block";
import { shortDate, stagger, PageTitle } from "~/components/ui/terminal";
import { cvContent } from "~/lib/cv";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanPrep, prepRequest, storedPrep, storedStories } from "~/server/cv/prep";
import { storedResearch } from "~/server/cv/research";
import { getDb } from "~/server/db/client.server";
import { getApplication, savePrep } from "~/server/db/queries/applications.server";
import { getCv, getStories } from "~/server/db/queries/profile.server";
import { latestTailoredCv } from "~/server/db/queries/tailored-cv.server";
import { jsonField } from "~/server/form.server";

export const handle = { title: () => "Interview prep" };

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const row = await getApplication(db, user.id, params.id);
  if (!row) throw data("Not found", { status: 404 });
  const application = { id: row.id, company: row.company, role: row.role, logoUrl: row.logoUrl };
  const prep = storedPrep(row.prepJson);
  const research = storedResearch(row.researchJson);
  if (!row.description) return { application, prep, research, request: null };
  const [cv, tailored, stories] = await Promise.all([getCv(db, user.id), latestTailoredCv(db, user.id, row.id), getStories(db, user.id)]);
  const request = prepRequest(row, tailored?.cv ?? cvContent(cv), cv.confirmed, research, storedStories(stories));
  return { application, prep, research, request };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const form = await request.formData();
  if (form.get("intent") !== "prep") throw data("Unknown intent", { status: 400 });
  await savePrep(getDb(env.DB), user.id, params.id, JSON.stringify(cleanPrep(jsonField(form, "result", "{}"))));
  return { ok: true };
}

export default function InterviewPrepPage({ loaderData }: Route.ComponentProps) {
  const { application, prep, research, request } = loaderData;
  return (
    <div className={`flex flex-col gap-10 ${SANS_PAGE}`}>
      <header className="rise flex min-w-0 items-start gap-4" style={stagger(0)}>
        <CompanyLogo company={application.company} logoUrl={application.logoUrl} className="mt-0.5 size-12 text-[18px]" />
        <PageTitle
          className="min-w-0 gap-0.5"
          title={application.company}
          sub={
            <>
              {application.role} ·{" "}
              <Link to={`/applications/${application.id}`} className="text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline">
                Back to the application
              </Link>
            </>
          }
        />
      </header>

      <div className="rise grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12" style={stagger(1)}>
        <div className="flex min-w-0 flex-col gap-12">
          <PageSection id="questions" title="Likely questions" description={prep ? `${prep.questions.length} questions with answers built from your stories and CV.` : undefined}>
            {prep ? (
              <PrepQuestions questions={prep.questions} />
            ) : (
              <div className="border border-stroke-secondary px-6 py-10 text-center">
                <p className="font-medium text-text-primary">No prep yet</p>
                <p className="mt-1 text-[13px] text-text-tertiary">
                  Prepare to get likely questions with STAR answers, questions to ask them and what to brush up on.
                </p>
              </div>
            )}
          </PageSection>
          {research && (
            <PageSection id="research" title="Company research" description={`Researched ${shortDate(research.researchedAt)}`}>
              <ResearchView research={{ ...research, facts: [] }} />
            </PageSection>
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">
          <PrepareBlock prep={prep} request={request} />
          {prep && <PrepList title="Ask them" items={prep.askThem} />}
          {prep && <PrepList title="Brush up on" items={prep.brushUp} />}
          {research && research.facts.length > 0 && (
            <SideBlock title="Company">
              <dl className="flex flex-col gap-2">
                {research.facts.map((f) => (
                  <div key={f.label} className="flex items-baseline justify-between gap-4 text-[13.5px]">
                    <dt className="shrink-0 text-text-tertiary">{f.label}</dt>
                    <dd className="min-w-0 text-right text-text-primary">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </SideBlock>
          )}
        </aside>
      </div>
    </div>
  );
}
