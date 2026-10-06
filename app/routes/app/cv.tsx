import { useState } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/cv";
import { CV_SECTIONS, CvEditor } from "~/components/cv";
import { TemplateEditor } from "~/components/cv/template-editor";
import { PdfButton, TypstPreview } from "~/components/cv/typst-preview";
import { Button } from "~/components/ui/button";
import { SettingsNav } from "~/components/ui/settings-nav";
import { Section, stagger } from "~/components/ui/terminal";
import { UnsavedBar } from "~/components/ui/unsaved-bar";
import { cvContent, personFor, typstCv } from "~/lib/cv";
import { DEFAULT_CV_TEMPLATE } from "~/lib/typst";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanCv } from "~/server/cv/clean";
import { importCv, MAX_PDF_BYTES, pdfText } from "~/server/cv/import.server";
import { getDb } from "~/server/db/client.server";
import { getCv, getCvTemplate, getProfile, saveCv, saveCvTemplate } from "~/server/db/queries/profile.server";
import type { Cv } from "~/types/cv";

const MAX_TEMPLATE_CHARS = 50_000;

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [cv, profile, template] = await Promise.all([getCv(db, user.id), getProfile(db, user.id), getCvTemplate(db, user.id)]);
  return { cv, person: personFor(profile.personal, user), template };
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
  if (form.get("intent") === "template") {
    const template = String(form.get("template") ?? "").slice(0, MAX_TEMPLATE_CHARS);
    await saveCvTemplate(db, user.id, template.trim() ? template : null);
    return { ok: true };
  }
  await saveCv(db, user.id, cleanCv(JSON.parse(String(form.get("cv") ?? "{}"))));
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
  const styling = params.has("template");
  const setMode = (mode: "edit" | "template" | null) =>
    setParams(mode ? { [mode]: "" } : {}, { replace: true, preventScrollReset: true });
  const template = loaderData.template ?? DEFAULT_CV_TEMPLATE;
  const data = typstCv(loaderData.person, cvContent(cv));

  const save = (
    <Button type="submit" size="medium" disabled={saving || !dirty}>
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <Form
      method="post"
      onSubmit={() => setDirty(false)}
      className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6"
    >
      <input type="hidden" name="cv" value={JSON.stringify(cv)} />

      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[03]</b>CV
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            Your CV
          </h1>
          <p className="mt-3 font-sans text-[13px] normal-case tracking-normal text-text-secondary">
            Everything you've done, in your own words. Each job's tailored CV is rewritten from this.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-green-primary">Saved</span>}
          {editing && save}
          {editing || styling ? (
            <Button type="button" variant="ghost" size="medium" className="uppercase" onClick={() => setMode(null)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" size="medium" className="uppercase" onClick={() => setMode("template")}>
                Edit template
              </Button>
              <Button type="button" size="medium" className="uppercase" onClick={() => setMode("edit")}>
                Edit CV
              </Button>
            </>
          )}
        </div>
      </header>

      {!editing && !styling && (
        <Section n="01" title="CV" hint="What every tailored CV is rewritten from." i={1}>
          <div className="flex flex-wrap items-start gap-6">
            <TypstPreview template={template} cv={data} width={380} />
            <PdfButton template={template} cv={data} filename={`${loaderData.person.name || "CV"} - CV.pdf`} />
          </div>
        </Section>
      )}

      {styling && (
        <Section n="01" title="Template" hint="Typst. Controls how every CV looks." i={1}>
          <TemplateEditor saved={loaderData.template} cv={data} />
        </Section>
      )}

      {editing && (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
          <aside className="hidden lg:block">
            <SettingsNav items={CV_SECTIONS.map((s) => ({ n: s.n, href: `#${s.id}`, label: s.title }))} />
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
            <p className="text-[11px] tracking-[0.12em] text-text-secondary">Preview</p>
            <TypstPreview template={template} cv={data} width={300} />
          </aside>
        </div>
      )}

      {dirty && <UnsavedBar>{save}</UnsavedBar>}
    </Form>
  );
}
