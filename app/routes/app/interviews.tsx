import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/interviews";
import { DraftStories, StoryList } from "~/components/interviews/stories";
import { cvContent } from "~/lib/cv";
import { Button } from "~/components/ui/button";
import { StatusBadge } from "~/components/ui/status-badge";
import { Section, fmtDate, stagger } from "~/components/ui/terminal";
import { UnsavedBar } from "~/components/ui/unsaved-bar";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanStories, draftStoriesRequest, storedStories } from "~/server/cv/prep";
import { getDb } from "~/server/db/client.server";
import { getCv, getStories, saveStories } from "~/server/db/queries/profile.server";
import { applicationsFor } from "~/server/db/queries/status.server";
import type { StarStory } from "~/types/cv";
import { PREP_STATUSES } from "~/lib/status";

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  const db = getDb(context.get(envContext).DB);
  const [json, apps, cv] = await Promise.all([getStories(db, user.id), applicationsFor(db, user.id), getCv(db, user.id)]);
  const stories = storedStories(json);
  const upcoming = apps.filter((a) => PREP_STATUSES.has(a.status)).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  const hasCv = cv.experience.length > 0 || cv.projects.length > 0;
  return { stories, upcoming, draftRequest: hasCv ? draftStoriesRequest(cvContent(cv), cv.confirmed, stories) : null };
}

export async function action({ request, context }: Route.ActionArgs) {
  const user = context.get(userContext);
  const db = getDb(context.get(envContext).DB);
  const form = await request.formData();
  const stories = cleanStories(JSON.parse(String(form.get("stories") ?? "[]")));
  await saveStories(db, user.id, JSON.stringify(stories));
  return { ok: true };
}

export default function InterviewsPage({ loaderData, actionData }: Route.ComponentProps) {
  const [stories, setStories] = useState<StarStory[]>(loaderData.stories);
  const [dirty, setDirty] = useState(false);
  const nav = useNavigation();
  const saving = nav.state === "submitting";
  const saved = actionData?.ok && nav.state === "idle" && !dirty;

  const save = (
    <Button type="submit" size="medium" disabled={saving || !dirty}>
      {saving ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <Form method="post" onSubmit={() => setDirty(false)} className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em]">
      <input type="hidden" name="stories" value={JSON.stringify(stories)} />

      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[04]</b>Interviews
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            Your interviews
          </h1>
          <p className="mt-3 font-sans text-[13px] normal-case tracking-normal text-text-secondary">
            Your STAR stories, told once. Each job's interview prep answers from them.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-green-primary">Saved</span>}
          {save}
        </div>
      </header>

      <Section n="01" id="upcoming" title="Coming up" description="Applications in screening, assessment or interview." i={1}>
        {loaderData.upcoming.length ? (
          <ul className="flex flex-col">
            {loaderData.upcoming.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/applications/${a.id}#prep`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-stroke-secondary py-3 first:border-t hover:bg-fill-tertiary"
                >
                  <span className="text-text-primary">{a.company}</span>
                  <span className="min-w-0 flex-1 truncate font-sans normal-case tracking-normal text-text-secondary">{a.role}</span>
                  <StatusBadge status={a.status} />
                  <span className="text-text-tertiary tabular-nums">{fmtDate(a.appliedAt)}</span>
                  <span className="text-text-secondary">Prepare ›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
            When an application moves to screening, assessment or interview, it shows here with its prep.
          </p>
        )}
      </Section>

      <Section n="02" id="stories" title="STAR stories" description="In your own words. Specific beats polished." i={2}>
        <DraftStories
          request={loaderData.draftRequest}
          onDrafted={(drafts) => {
            setStories((current) => [...current, ...drafts]);
            setDirty(true);
          }}
        />
        <StoryList
          value={stories}
          onChange={(next) => {
            setStories(next);
            setDirty(true);
          }}
        />
      </Section>

      {dirty && <UnsavedBar>{save}</UnsavedBar>}
    </Form>
  );
}
