import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { data, Form, Link, redirect } from "react-router";
import type { Route } from "./+types/role-cv";
import { ScoreView } from "~/components/tailored-cv/score";
import { TailoredTabs } from "~/components/tailored-cv/tailored-tabs";
import { TailorPanel } from "~/components/tailored-cv/tailor-panel";
import { Button } from "~/components/ui/button";
import { SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock } from "~/components/ui/side-block";
import { shortDate, stagger, PageTitle } from "~/components/ui/terminal";
import { cvContent, personFor } from "~/lib/cv";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { applyEdits } from "~/server/cv/tailored";
import { atsScore } from "~/server/cv/tailoring/keywords";
import { evidenceText, impliedTerms, scoreBefore } from "~/server/cv/tailoring/questions";
import { getDb } from "~/server/db/client.server";
import { jsonField } from "~/server/form.server";
import { getCv, getCvDesign, getProfile } from "~/server/db/queries/profile.server";
import { deleteRoleCv, getRoleCv, saveRoleCv } from "~/server/db/queries/role-cv.server";
import type { AtsScore } from "~/types/cv";

export const handle = { title: (data: { role: { title: string } }) => data.role.title };

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [role, cv, profile, design] = await Promise.all([getRoleCv(db, user.id, params.id), getCv(db, user.id), getProfile(db, user.id), getCvDesign(db, user.id)]);
  if (!role) throw data("Not found", { status: 404 });
  const hasCv = cv.experience.length > 0 || cv.summaries.length > 0;
  const score: { before: AtsScore; after?: AtsScore } | null = role.cv?.score ?? (role.keywords ? { before: scoreBefore(cvContent(cv), cv.confirmed, role.keywords) } : null);
  return { role, hasCv, score, person: personFor(profile.personal, user), design };
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
  const edited = applyEdits(role.cv, jsonField(form, "cv", "{}"));
  if (role.keywords && edited.score) edited.score = { ...edited.score, after: atsScore(edited, role.keywords, evidenceText(cvContent(cv), cv.confirmed), impliedTerms(cv.confirmed)) };
  await saveRoleCv(db, user.id, role.id, role.version + 1, edited);
  return { ok: true };
}

export default function RoleCvPage({ loaderData }: Route.ComponentProps) {
  const { role, hasCv, score, person, design } = loaderData;

  return (
    <div className={`flex flex-col gap-8 ${SANS_PAGE}`}>
      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <PageTitle title="CV for a role" sub={`${role.title} · no job description, tailored to what this title usually asks for`} />
        <Form method="post">
          <Button type="submit" name="intent" value="delete" variant="ghost" className="h-9 px-3 text-[13.5px] text-text-secondary hover:bg-red-quaternary hover:text-red-primary">
            <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.5} />
            Delete
          </Button>
        </Form>
      </header>

      <div className="rise" style={stagger(1)}>
        {hasCv ? (
          <TailorPanel target={{ roleId: role.id }} company={role.title} role="Job title only" research={null} hasResearch={false} retailor={!!role.cv} />
        ) : (
          <div className="border border-stroke-secondary px-6 py-10 text-center">
            <p className="font-medium text-text-primary">Add your CV first</p>
            <p className="mt-1 text-[13px] text-text-tertiary">
              Tailoring rewrites your master CV for this role.{" "}
              <Link to="/cv?edit" className="text-text-primary underline underline-offset-4">
                Add your experience
              </Link>
              , then come back.
            </p>
          </div>
        )}
      </div>

      <div className="rise grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12" style={stagger(2)}>
        <div className="flex min-w-0 flex-col gap-10">
          <TailoredTabs cv={role.cv ?? null} person={person} design={design} filename={`${person.name || "CV"} - ${role.title} CV.pdf`} score={score} />
        </div>
        <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">
          {score && (
            <SideBlock title="Match score" aside={score.after ? "After tailoring" : "Your CV as it is"}>
              <ScoreView before={score.before} after={score.after} />
            </SideBlock>
          )}
          <SideBlock title="This CV">
            <p className="text-[13.5px] text-text-secondary">{role.cv ? `Version ${role.version} · tailored ${shortDate(role.updatedAt)}` : "Not tailored yet"}</p>
            <Link to="/cv#roles" className="text-[13px] text-text-secondary underline-offset-4 hover:text-text-primary hover:underline">
              Back to your CV
            </Link>
          </SideBlock>
        </aside>
      </div>
    </div>
  );
}
