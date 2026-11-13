import { useState } from "react";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock, SideRow } from "~/components/ui/side-block";
import { Form, redirect, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/cv";
import { CV_SECTIONS, CvEditor } from "~/components/cv";
import { RoleCvs } from "~/components/cv/role-cvs";
import { TailoredCvList } from "~/components/cv/tailored-grid";
import { CvPreview, PdfButton } from "~/components/cv/cv-preview";
import { Button } from "~/components/ui/button";
import { SettingsNav } from "~/components/ui/settings-nav";
import { stagger, PageTitle } from "~/components/ui/terminal";
import { UnsavedBar } from "~/components/ui/unsaved-bar";
import { cvContent, personFor, pdfCv } from "~/lib/cv";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanCv } from "~/server/cv/clean";
import { importCv, MAX_PDF_BYTES, pdfText } from "~/server/cv/import.server";
import { MAX_TITLE_CHARS } from "~/server/cv/tailoring/role";
import { getDb } from "~/server/db/client.server";
import { jsonField } from "~/server/form.server";
import { getCv, getProfile, saveCv } from "~/server/db/queries/profile.server";
import { createRoleCv, listRoleCvs } from "~/server/db/queries/role-cv.server";
import { tailoredCvCards } from "~/server/db/queries/tailored-cv.server";
import type { Cv } from "~/types/cv";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [cv, profile, tailored, roles] = await Promise.all([
    getCv(db, user.id),
    getProfile(db, user.id),
    tailoredCvCards(db, user.id),
    listRoleCvs(db, user.id),
  ]);
  return { cv, person: personFor(profile.personal, user), tailored, roles };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const form = await request.formData();
  if (form.get("intent") === "import-cv") {
    const file = form.get("file");
    if (file instanceof File && file.size > MAX_PDF_BYTES) {
      return { imported: { error: "That PDF is over 5 MB. Paste the text instead." } };
    }
    const text = file instanceof File && file.size ? await pdfText(file).catch(() => "") : String(form.get("text") ?? "");
    return { imported: await importCv(env, db, user.id, text) };
  }
  if (form.get("intent") === "role") {
    const title = String(form.get("title") ?? "").trim().slice(0, MAX_TITLE_CHARS);
    if (title) throw redirect(`/cv/roles/${await createRoleCv(db, user.id, title)}`);
    return { ok: true };
  }
  await saveCv(db, user.id, cleanCv(jsonField(form, "cv", "{}")));
  return { ok: true };
}

export default function CvPage({ loaderData, actionData }: Route.ComponentProps) {
  const [cv, setCv] = useState<Cv>(loaderData.cv);
  const [dirty, setDirty] = useState(false);
  const nav = useNavigation();
  const saving = nav.state === "submitting" && nav.formData?.get("intent") !== "import-cv";
  const saved = actionData && "ok" in actionData && nav.state === "idle" && !dirty;
  const [params, setParams] = useSearchParams();
  const editing = params.has("edit");
  const setMode = (mode: "edit" | null) =>
    setParams(mode ? { [mode]: "" } : {}, { replace: true, preventScrollReset: true });
  const data = pdfCv(loaderData.person, cvContent(cv));

  const save = (
    <Button type="submit" size="medium" disabled={saving || !dirty}>
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <Form
      method="post"
      onSubmit={() => setDirty(false)}
      className={`flex flex-col gap-10 ${SANS_PAGE}`}
    >
      <input type="hidden" name="cv" value={JSON.stringify(cv)} />

      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div>
          <PageTitle
            title="Your CV"
            sub="Everything you've done, in your own words. Each job's tailored CV is rewritten from this."
          />
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-[13.5px] text-green-primary">Saved</span>}
          {editing && save}
          {editing ? (
            <Button type="button" variant="ghost" size="medium" className="uppercase" onClick={() => setMode(null)} data-tour="done-cv">
              Done
            </Button>
          ) : (
            <Button type="button" size="medium" className="uppercase" onClick={() => setMode("edit")} data-tour="edit-cv">
              Edit CV
            </Button>
          )}
        </div>
      </header>

      {!editing && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-12">
          <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start">
            <div>
              <h2 className="text-[16px] font-medium text-text-primary">Master CV</h2>
              <p className="mt-0.5 text-[13.5px] text-text-tertiary">What every tailored CV is rewritten from.</p>
            </div>
            <CvPreview cv={data} width={380} filename={`${loaderData.person.name || "CV"} - CV.pdf`} />
            <PdfButton cv={data} filename={`${loaderData.person.name || "CV"} - CV.pdf`} />
            <SideBlock title="What's in it">
              <div className="flex flex-col gap-2">
                <SideRow label="Roles" value={cv.experience.length} />
                <SideRow label="Education" value={cv.education.length} />
                <SideRow
                  label="Projects"
                  note={cv.projects.some((p) => p.optional) ? `${cv.projects.filter((p) => p.optional).length} in reserve` : undefined}
                  value={cv.projects.length}
                />
                <SideRow label="Skills" value={cv.skills.reduce((n, g) => n + g.items.length, 0)} />
                <SideRow label="Answers for tailoring" value={cv.confirmed.length} />
              </div>
            </SideBlock>
          </aside>

          <div className="flex min-w-0 flex-col gap-10">
            <PageSection id="tailored" title="Tailored CVs" description={`The latest for each job${loaderData.tailored.length ? ` · ${loaderData.tailored.length} in total` : ""}.`}>
              <TailoredCvList cards={loaderData.tailored} />
            </PageSection>
            <PageSection id="roles" title="Tailor to a role" description="No job description needed: just the job title.">
              <RoleCvs roles={loaderData.roles} />
            </PageSection>
          </div>
        </div>
      )}

      {editing && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
          <aside className="hidden lg:block">
            <SettingsNav items={CV_SECTIONS.map((s) => ({ href: `#${s.id}`, label: s.title }))} />
          </aside>
          <main className="flex flex-col gap-12">
            <CvEditor
              value={cv}
              onChange={(patch) => {
                setCv((current) => ({ ...current, ...patch }));
                setDirty(true);
              }}
            />
          </main>
          <aside className="flex flex-col gap-3 lg:col-start-2 xl:sticky xl:top-16 xl:col-start-3 xl:row-start-1 xl:self-start">
            <p className="text-[14px] font-medium text-text-primary">Preview</p>
            <CvPreview cv={data} width={300} filename={`${loaderData.person.name || "CV"} - CV.pdf`} />
          </aside>
        </div>
      )}

      {dirty && <UnsavedBar>{save}</UnsavedBar>}
    </Form>
  );
}
