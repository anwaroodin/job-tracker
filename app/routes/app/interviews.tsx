import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/interviews";
import { DraftStories, StoryList } from "~/components/interviews/stories";
import { cvContent } from "~/lib/cv";
import { Button } from "~/components/ui/button";
import { StatusBadge } from "~/components/ui/status-badge";
import { shortDate, stagger, PageTitle } from "~/components/ui/terminal";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock } from "~/components/ui/side-block";
import { CompanyLogo } from "~/components/applications/company-logo";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { cn } from "~/lib/cn";
import { UnsavedBar } from "~/components/ui/unsaved-bar";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { cleanStories, draftStoriesRequest, storedStories } from "~/server/cv/prep";
import { getDb } from "~/server/db/client.server";
import { jsonField } from "~/server/form.server";
import { getCv, getStories, saveStories } from "~/server/db/queries/profile.server";
import { applicationsFor } from "~/server/db/queries/status.server";
import type { StarStory } from "~/types/cv";
import { PREP_STATUSES } from "~/lib/status";

const STAR = [
  ["S", "Situation", "Where you were and what was going on."],
  ["T", "Task", "What you had to get done, and why it was hard."],
  ["A", "Action", "What you did yourself. Say “I”, not “we”."],
  ["R", "Result", "How it turned out, with a number if you have one."],
] as const;

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
  const stories = cleanStories(jsonField(form, "stories", "[]"));
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
    <Form method="post" onSubmit={() => setDirty(false)} className={`flex flex-col gap-10 ${SANS_PAGE}`}>
      <input type="hidden" name="stories" value={JSON.stringify(stories)} />

      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div>
          <PageTitle
            title="Your interviews"
            sub="Your STAR stories, told once. Each job's interview prep answers from them."
          />
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-[13.5px] text-green-primary">Saved</span>}
          {save}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          <PageSection id="upcoming" title="Coming up" description="Applications in screening, assessment or interview.">
        {loaderData.upcoming.length ? (
          <ul className={cn("flex flex-col", INSET_SEPARATORS)}>
            {loaderData.upcoming.map((a) => (
              <li key={a.id} className="relative">
                <Link to={`/applications/${a.id}#prep`} className="flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.04]">
                  <CompanyLogo company={a.company} className="size-9 text-[14px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-text-primary">{a.company}</span>
                    <span className="block truncate text-[12.5px] text-text-tertiary">
                      {a.role} · Applied {shortDate(a.appliedAt)}
                    </span>
                  </span>
                  <StatusBadge status={a.status} variant="dot" className="hidden w-24 shrink-0 text-[12.5px] sm:inline-flex" />
                  <span className="shrink-0 text-[13px] font-medium text-text-secondary">Prepare</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-stroke-secondary px-6 py-8 text-center text-[13.5px] leading-relaxed text-text-tertiary">
            When an application moves to screening, assessment or interview, it shows here with its prep.
          </p>
        )}
      </PageSection>

      <PageSection id="stories" title="STAR stories" description="In your own words. Specific beats polished.">
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
      </PageSection>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">
          <SideBlock title="A good story has">
            <ol className="flex flex-col gap-3">
              {STAR.map(([letter, name, hint]) => (
                <li key={letter} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center bg-ink/[0.06] text-[13px] font-medium text-text-primary">{letter}</span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-text-primary">{name}</span>
                    <span className="block text-[12.5px] leading-relaxed text-text-tertiary">{hint}</span>
                  </span>
                </li>
              ))}
            </ol>
          </SideBlock>
          <SideBlock title="How it's used">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              When a job reaches interview, its prep picks the stories that fit the role and turns them into answers for the questions it's likely to ask.
            </p>
          </SideBlock>
        </aside>
      </div>

      {dirty && <UnsavedBar>{save}</UnsavedBar>}
    </Form>
  );
}
