import { useState } from "react";
import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/role-cv";
import { PdfButton, TypstPreview } from "~/components/cv/typst-preview";
import { TailoredCvEditor } from "~/components/tailored-cv/editor";
import { EditsView } from "~/components/tailored-cv/edits";
import { ScoreView } from "~/components/tailored-cv/score";
import { TailorPanel } from "~/components/tailored-cv/tailor-panel";
import { Button } from "~/components/ui/button";
import { Section, fmtDate, stagger } from "~/components/ui/terminal";
import { cvContent, personFor, typstCv } from "~/lib/cv";
import { DEFAULT_CV_TEMPLATE } from "~/lib/typst";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { applyEdits } from "~/server/cv/tailored";
import { atsScore } from "~/server/cv/tailoring/keywords";
import { evidenceText, scoreBefore } from "~/server/cv/tailoring/questions";
import { getDb } from "~/server/db/client.server";
import { getCv, getCvTemplate, getProfile } from "~/server/db/queries/profile.server";
import { deleteRoleCv, getRoleCv, saveRoleCv } from "~/server/db/queries/role-cv.server";
import type { AtsScore } from "~/types/cv";

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [role, cv, profile, template] = await Promise.all([getRoleCv(db, user.id, params.id), getCv(db, user.id), getProfile(db, user.id), getCvTemplate(db, user.id)]);
  if (!role) throw data("Not found", { status: 404 });
  const hasCv = cv.experience.length > 0 || cv.summaries.length > 0;
  const score: { before: AtsScore; after?: AtsScore } | null = role.cv?.score ?? (role.keywords ? { before: scoreBefore(cvContent(cv), cv.confirmed, role.keywords) } : null);
  return { role, hasCv, score, person: personFor(profile.personal, user), template };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const form = await request.formData();
  const [role, cv] = await Promise.all([getRoleCv(db, user.id, params.id), getCv(db, user.id)]);
  if (!role) throw data("Not found", { status: 404 });

  if (form.get("intent") === "delete") {
    await deleteRoleCv(db, user.id, role.id);
    throw redirect("/cv");
  }
  if (form.get("intent") !== "edit" || !role.cv) throw data("Unknown action", { status: 400 });
  const edited = applyEdits(role.cv, JSON.parse(String(form.get("cv") ?? "{}")));
  if (role.keywords && edited.score) edited.score = { ...edited.score, after: atsScore(edited, role.keywords, evidenceText(cvContent(cv), cv.confirmed)) };
  await saveRoleCv(db, user.id, role.id, role.version + 1, edited);
  return { ok: true };
}

export default function RoleCvPage({ loaderData }: Route.ComponentProps) {
  const { role, hasCv, score, person } = loaderData;
  const template = loaderData.template ?? DEFAULT_CV_TEMPLATE;
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div className="flex flex-col gap-6">
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <Link to="/cv" className="transition-colors hover:text-text-primary">
              [03] CV
            </Link>
            <span className="mx-2 opacity-50">/</span>
            Role
          </p>
          <h1 className="max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            CV for a role
            <span className="block text-text-tertiary">{role.title}</span>
          </h1>
        </div>
        <Form method="post">
          <Button type="submit" name="intent" value="delete" variant="ghost" size="medium" className="uppercase">
            Delete
          </Button>
        </Form>
      </header>

      <Section n="01" title="Tailor" hint={role.cv ? `Version ${role.version} · ${fmtDate(role.updatedAt)}` : "No job description: tailored to what the job title usually asks for."} i={1}>
        {hasCv ? (
          <TailorPanel target={{ roleId: role.id }} research={null} hasResearch={false} retailor={!!role.cv} />
        ) : (
          <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
            Add your{" "}
            <Link to="/cv?edit" className="text-accent-primary hover:text-accent-secondary">
              CV
            </Link>{" "}
            first.
          </p>
        )}
      </Section>

      {score && (
        <Section n="02" title="Match score" hint={score.after ? "After tailoring" : "Your CV as it is"} i={2}>
          <ScoreView before={score.before} after={score.after} />
        </Section>
      )}

      {role.cv && (role.cv.edits?.length || role.cv.flags.length || role.cv.changes.length) ? (
        <Section n="03" title="What changed" hint={role.cv.edits ? `${role.cv.edits.length} edits` : undefined} i={3}>
          <EditsView cv={role.cv} keywords={score?.before.keywords.map((k) => k.term) ?? []} />
        </Section>
      ) : null}

      {role.cv && editing && (
        <Section n="04" title="Edit" i={4}>
          <TailoredCvEditor value={role.cv} onDone={() => setEditing(false)} />
        </Section>
      )}

      {role.cv && !editing && (
        <Section n="04" title="CV" hint={<Button type="button" variant="link" size="tiny" className="h-auto px-0 uppercase" onClick={() => setEditing(true)}>Edit</Button>} i={4}>
          <div className="flex flex-col gap-3">
            <div className="self-end">
              <PdfButton template={template} cv={typstCv(person, role.cv)} filename={`${person.name || "CV"} - ${role.title} CV.pdf`} />
            </div>
            <TypstPreview template={template} cv={typstCv(person, role.cv)} />
          </div>
        </Section>
      )}
    </div>
  );
}
