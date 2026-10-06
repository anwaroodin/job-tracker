import { useState } from "react";
import { data, Link } from "react-router";
import type { Route } from "./+types/cv";
import { PdfButton, TypstPreview } from "~/components/cv/typst-preview";
import { CoverLetterDocument } from "~/components/tailored-cv/document";
import { TailoredCvEditor } from "~/components/tailored-cv/editor";
import { EditsView } from "~/components/tailored-cv/edits";
import { ResearchView } from "~/components/tailored-cv/research";
import { ScoreView } from "~/components/tailored-cv/score";
import { TailorPanel } from "~/components/tailored-cv/tailor-panel";
import { Button } from "~/components/ui/button";
import { Section, fmtDate, stagger } from "~/components/ui/terminal";
import { cvContent, personFor, typstCv } from "~/lib/cv";
import { DEFAULT_CV_TEMPLATE } from "~/lib/typst";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanResearch, researchRequest, storedResearch } from "~/server/cv/research";
import { applyEdits } from "~/server/cv/tailored";
import { storedJobKeywords } from "~/server/cv/tailoring/cache";
import { atsScore, contentText } from "~/server/cv/tailoring/keywords";
import { getDb } from "~/server/db/client.server";
import { getApplication, saveResearch } from "~/server/db/queries/applications.server";
import { getCv, getCvTemplate, getProfile } from "~/server/db/queries/profile.server";
import { insertTailoredCv, latestTailoredCv } from "~/server/db/queries/tailored-cv.server";
import type { AtsScore } from "~/types/cv";

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [row, cv, profile, tailored, template] = await Promise.all([
    getApplication(db, user.id, params.id),
    getCv(db, user.id),
    getProfile(db, user.id),
    latestTailoredCv(db, user.id, params.id),
    getCvTemplate(db, user.id),
  ]);
  if (!row) throw data("Not found", { status: 404 });

  const keywords = await storedJobKeywords(row);
  const master = cvContent(cv);
  const hasCv = cv.experience.length > 0 || cv.summaries.length > 0;
  const score: { before: AtsScore; after?: AtsScore } | null = tailored?.cv.score ?? (keywords ? { before: atsScore(master, keywords, contentText(master)) } : null);
  return {
    application: { id: row.id, company: row.company, role: row.role },
    canTailor: hasCv && !!row.description,
    researchRequest: row.description ? researchRequest(row) : null,
    research: storedResearch(row.researchJson),
    hasCv,
    hasDescription: !!row.description,
    score,
    person: personFor(profile.personal, user),
    tailored,
    template,
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
    await saveResearch(db, user.id, row.id, JSON.stringify(cleanResearch(JSON.parse(String(form.get("result") ?? "{}")))));
    return { ok: true };
  }

  if (intent !== "edit" || !latest) throw data("Unknown action", { status: 400 });
  const edited = applyEdits(latest.cv, JSON.parse(String(form.get("cv") ?? "{}")));
  const keywords = await storedJobKeywords(row);
  if (keywords && edited.score) edited.score = { ...edited.score, after: atsScore(edited, keywords, contentText(cvContent(cv))) };
  await insertTailoredCv(db, user.id, row.id, latest.version + 1, edited);
  return { ok: true };
}

export default function TailoredCvPage({ loaderData }: Route.ComponentProps) {
  const { application, canTailor, researchRequest, research, hasCv, hasDescription, score, person, tailored } = loaderData;
  const template = loaderData.template ?? DEFAULT_CV_TEMPLATE;
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise flex flex-col gap-6" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <Link to="/applications" className="transition-colors hover:text-text-primary">
            [02] Applications
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <Link to={`/applications/${application.id}`} className="transition-colors hover:text-text-primary">
            {application.company}
          </Link>
          <span className="mx-2 opacity-50">/</span>
          CV
        </p>
        <h1 className="max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
          Tailored CV
          <span className="block text-text-tertiary">{application.role}</span>
        </h1>
      </header>

      <Section n="01" title="Tailor" hint={tailored ? `Version ${tailored.version} · ${fmtDate(tailored.createdAt)}` : undefined} i={1}>
        {canTailor ? (
          <TailorPanel applicationId={application.id} research={researchRequest} hasResearch={!!research} retailor={!!tailored} />
        ) : (
          <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
            {!hasCv ? (
              <>
                Add your{" "}
                <Link to="/cv?edit" className="text-accent-primary hover:text-accent-secondary">
                  CV
                </Link>{" "}
                first.
              </>
            ) : (
              !hasDescription && "This application has no job description to tailor to. Open the posting with the extension to capture it."
            )}
          </p>
        )}
      </Section>

      {research && (
        <Section n="02" title="Company" hint={`What ${application.company} values`} i={2}>
          <ResearchView research={research} />
        </Section>
      )}

      {score && (
        <Section n="03" title="Match score" hint={score.after ? "After tailoring" : "Your CV as it is"} i={2}>
          <ScoreView before={score.before} after={score.after} />
        </Section>
      )}

      {tailored && (tailored.cv.edits?.length || tailored.cv.flags.length || tailored.cv.changes.length) ? (
        <Section n="04" title="What changed" hint={tailored.cv.edits ? `${tailored.cv.edits.length} edits` : undefined} i={3}>
          <EditsView cv={tailored.cv} keywords={score?.before.keywords.map((k) => k.term) ?? []} />
        </Section>
      ) : null}

      {tailored && editing && (
        <Section n="05" title="Edit" i={4}>
          <TailoredCvEditor value={tailored.cv} onDone={() => setEditing(false)} />
        </Section>
      )}

      {tailored && !editing && (
        <>
          <Section n="05" title="CV" hint={<Button type="button" variant="link" size="tiny" className="h-auto px-0 uppercase" onClick={() => setEditing(true)}>Edit</Button>} i={4}>
            <div className="flex flex-col gap-3">
              <div className="self-end">
                <PdfButton template={template} cv={typstCv(person, tailored.cv)} filename={`${person.name || "CV"} - ${application.company} CV.pdf`} />
              </div>
              <TypstPreview template={template} cv={typstCv(person, tailored.cv)} />
            </div>
          </Section>
          <Section n="06" title="Cover letter" i={5}>
            <CoverLetterDocument person={person} letter={tailored.cv.coverLetter} />
          </Section>
        </>
      )}
    </div>
  );
}
