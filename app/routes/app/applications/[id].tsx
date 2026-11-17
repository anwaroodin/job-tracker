import { data, redirect, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/[id]";
import type { loader as layoutLoader } from "../layout";
import { ContactList } from "~/components/application-detail/contact-list";
import { CompanyLogo } from "~/components/applications/company-logo";
import { FactChips, listingFacts } from "~/components/application-detail/fact-chips";
import { FlagToggle } from "~/components/applications/flag-toggle";
import { DeleteApplication } from "~/components/application-detail/delete-application";
import { EditDetails } from "~/components/application-detail/edit-details";
import { ShareLink } from "~/components/application-detail/share-link";
import { StatusPicker } from "~/components/application-detail/status-picker";
import { BackToSaved, SavedActions } from "~/components/application-detail/saved-actions";
import { stagger, PageTitle } from "~/components/ui/terminal";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock } from "~/components/ui/side-block";
import { cn } from "~/lib/cn";
import { PREP_STATUSES } from "~/lib/status";
import { parseContacts } from "~/lib/contacts";
import { isEmailCategory } from "~/lib/email";
import { gmailComposeUrl, gmailThreadUrl } from "~/lib/gmail";
import { hostOf } from "~/lib/format/url";
import { useArrivals } from "~/hooks/use-arrivals";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { createApplication, deleteApplication, updateApplication } from "~/server/db/queries/applications.server";
import { applicationsFor } from "~/server/db/queries/status.server";
import { shareLinkFor } from "~/server/db/queries/share-links.server";
import { tailoredApplicationIds } from "~/server/db/queries/tailored-cv.server";
import { detailsFromForm } from "~/server/services/applications/details.server";
import { setStatusByHand } from "~/server/services/status/manual.server";
import { settleSavedJob, unsettleAppliedJob } from "~/server/services/status/saved.server";
import { markReplyDone, markViewed, moveEmail, setEmailCategory, setEmailDismissed } from "~/server/db/queries/emails.server";
import { applicationTimeline } from "~/server/services/timeline/index.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { TimelineItem } from "~/components/application-detail/timeline-item";
import { EmailItem } from "~/components/application-detail/email-item";
import { UnlinkedEmails } from "~/components/application-detail/unlinked-emails";
import { useNewOnArrival } from "~/components/application-detail/use-new-on-arrival";
import { Journey } from "~/components/application-detail/journey";
import { CvPanel, DetailsPanel, NotesPanel, PrepPanel } from "~/components/application-detail/details-panel";
import { JobDescription } from "~/components/application-detail/job-description";
import { storedJobKeywords } from "~/server/cv/tailoring/cache";
import { allKeywords } from "~/server/cv/tailoring/keywords";
import { FollowUp } from "~/components/application-detail/follow-up";
import { followUpDraft, followUpRecipient, quietDays } from "~/server/services/follow-up/rules";
import { BrandWord, statusWord } from "~/components/shell/brand-word";

const MAX_FIELD_LENGTH = 200;

export const handle = { title: (data: { row: { company: string } }) => data.row.company };

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [{ row, emails }, apps, shareLink, tailored] = await Promise.all([
    applicationTimeline(db, user.id, params.id),
    applicationsFor(db, user.id),
    shareLinkFor(db, user.id, params.id, new Date().toISOString()),
    tailoredApplicationIds(db, user.id),
  ]);
  if (!row) throw data("Not found", { status: 404 });
  const unseen = emails.filter((e) => !e.viewedAt && !e.dismissedAt).map((e) => e.id);
  if (unseen.length) await markViewed(db, user.id, unseen);
  const otherApplications = apps
    .filter((a) => a.id !== row.id && a.status !== "saved")
    .map(({ id, company, role, appliedAt }) => ({ id, company, role, appliedAt }));
  const share = { applicationId: row.id, link: shareLink, hasTailoredCv: tailored.has(row.id) };
  const keywords = await storedJobKeywords(row);
  const prep = row.prepJson || PREP_STATUSES.has(row.status) ? { prepared: !!row.prepJson } : null;
  const highlights = keywords ? allKeywords(keywords) : [];
  return { row, emails, otherApplications, accountEmail: user.email, share, followUp: followUpFor(row, emails, user), prep, highlights };
}

function followUpFor(
  row: Parameters<typeof quietDays>[0] & Parameters<typeof followUpDraft>[0],
  emails: { id: string; threadId: string | null; fromAddress: string | null; receivedAt: string | null; dismissedAt: string | null }[],
  user: { name?: string | null; email: string },
) {
  const linked = emails.flatMap((e) =>
    !e.dismissedAt && e.receivedAt ? [{ fromAddress: e.fromAddress ?? "", receivedAt: e.receivedAt, thread: e.threadId || e.id }] : [],
  );
  const lastEmailAt = linked.map((e) => e.receivedAt).sort().at(-1) ?? null;
  const days = quietDays(row, lastEmailAt, new Date());
  if (days === null) return null;
  const draft = { to: followUpRecipient(linked), ...followUpDraft(row, user.name ?? "") };
  const thread = linked.filter((e) => draft.to && e.fromAddress === draft.to).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]?.thread;
  return {
    quietDays: days,
    account: user.email,
    ...draft,
    threadUrl: thread ? gmailThreadUrl(user.email, thread) : null,
    composeUrl: gmailComposeUrl(user.email, draft),
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const form = await request.formData();
  const intent = form.get("intent");
  const emailId = String(form.get("id"));
  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
  if (intent === "flag") {
    // The star, shown as a bookmark while the posting is only saved.
    await updateApplication(db, user.id, params.id, { starred: form.get("flagged") === "true" });
    return { ok: true };
  }
  if (intent === "saved-applied") {
    if (!(await settleSavedJob(db, user.id, params.id, "applied"))) throw data("Not a saved posting", { status: 400 });
    return { ok: true };
  }
  if (intent === "unapply") {
    if (!(await unsettleAppliedJob(db, user.id, params.id))) throw data("It already has emails", { status: 400 });
    return { ok: true };
  }
  if (intent === "edit") {
    const details = detailsFromForm(form);
    if (!details) return { error: "Company and role are required" };
    await updateApplication(db, user.id, params.id, details);
    return { ok: true };
  }
  if (intent === "delete") {
    if (!(await deleteApplication(db, user.id, params.id))) throw data("Not found", { status: 404 });
    return redirect("/applications");
  }
  if (intent === "followed-up") {
    await updateApplication(db, user.id, params.id, { followedUpAt: new Date().toISOString() });
    return { ok: true };
  }
  if (intent === "status") {
    if (!(await setStatusByHand(db, user.id, params.id, String(form.get("status") ?? "")))) throw data("Unknown status", { status: 400 });
    return { ok: true };
  }
  if (intent === "replied") {
    await markReplyDone(db, user.id, emailId);
    return { ok: true };
  }
  if (intent === "move") {
    let target = String(form.get("applicationId") ?? "");
    if (!target) {
      const company = String(form.get("company") ?? "").trim().slice(0, MAX_FIELD_LENGTH);
      const role = String(form.get("role") ?? "").trim().slice(0, MAX_FIELD_LENGTH);
      if (!company || !role) return { error: "Company and role are required" };
      const appliedAt = new Date(String(form.get("appliedAt") ?? ""));
      target = crypto.randomUUID();
      await createApplication(db, {
        id: target,
        userId: user.id,
        company,
        role,
        autoFilled: false,
        ...(Number.isNaN(appliedAt.getTime()) ? {} : { appliedAt: appliedAt.toISOString() }),
      });
    }
    if (!(await moveEmail(db, user.id, params.id, emailId, target))) return { error: "Couldn't move that email" };
    await Promise.all([refreshApplicationStatus(db, user.id, params.id), refreshApplicationStatus(db, user.id, target)]);
    return redirect(`/applications/${target}`);
  }
  if (intent === "categorize") {
    const category = form.get("category");
    if (!isEmailCategory(category)) throw data("Unknown category", { status: 400 });
    await setEmailCategory(db, user.id, emailId, category);
  } else if (intent === "unlink" || intent === "relink") {
    await setEmailDismissed(db, user.id, params.id, emailId, intent === "unlink");
  } else {
    throw data("Unknown intent", { status: 400 });
  }
  await refreshApplicationStatus(db, user.id, params.id);
  return { ok: true };
}

export default function ApplicationDetail({ loaderData }: Route.ComponentProps) {
  return <Application key={loaderData.row.id} loaderData={loaderData} />;
}

function Application({ loaderData }: Pick<Route.ComponentProps, "loaderData">) {
  const { row, accountEmail } = loaderData;
  const saved = row.status === "saved";
  const hasLead = !saved || !!loaderData.followUp;
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const isNew = useNewOnArrival(row.id, loaderData.emails);
  const isArrival = useArrivals(
    loaderData.emails.map((e) => e.id),
    row.id,
  );
  const emails = loaderData.emails.filter((e) => !e.dismissedAt);
  const unlinked = loaderData.emails.filter((e) => e.dismissedAt);
  const latest = emails.at(-1)?.id;
  const source = hostOf(row.url) || undefined;
  const contacts = parseContacts(row.contactsJson);
  const move = { company: row.company, applications: loaderData.otherApplications };

  return (
    <div className={`flex flex-col gap-10 ${SANS_PAGE}`}>
      <header className="rise flex flex-col gap-5" style={stagger(0)}>
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo company={row.company} logoUrl={row.logoUrl} className="mt-0.5 size-12 text-[18px]" />
            <PageTitle className="min-w-0 gap-0.5" title={row.company} sub={row.role} />
          </div>
          {saved ? (
            <SavedActions url={row.url} />
          ) : (
            <div className="flex items-center gap-4">
              {statusWord(row.status) && <BrandWord word={statusWord(row.status)!} size={22} />}
              <StatusPicker id={row.id} status={row.status} company={row.company} role={row.role} />
            </div>
          )}
        </div>

        <FactChips facts={listingFacts(row)} />

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-stroke-secondary py-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="inline-flex h-8 items-center px-3 text-[13px]">
              <FlagToggle id={row.id} status={row.status} flagged={row.starred} />
            </span>
            <EditDetails job={row} />
            <ShareLink {...loaderData.share} />
            {!saved && emails.length === 0 && <BackToSaved />}
          </div>
          <DeleteApplication company={row.company} role={row.role} />
        </div>
      </header>

      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-14">
        {hasLead && <div className="flex flex-col gap-12 lg:col-start-1 lg:row-start-1">
          {loaderData.followUp && <FollowUp {...loaderData.followUp} />}
          {!saved && <Journey status={row.status} appliedAt={row.appliedAt} updatedAt={row.updatedAt} emails={emails} />}

          {!saved && <PageSection
            id="timeline"
            title="Timeline"
            description={
              emails.length
                ? `${emails.length} ${emails.length === 1 ? "email" : "emails"} from Gmail, oldest first.`
                : "Emails about this application show up here."
            }
          >
            <ol className="flex flex-col">
              <TimelineItem
                date={row.appliedAt}
                category="applied"
                title="Application logged"
                meta={row.url ? "Open job posting" : undefined}
                href={row.url || undefined}
              />
              {emails.map((e) => (
                <EmailItem
                  key={e.id}
                  email={e}
                  isNew={isNew(e)}
                  arrived={isArrival(e.id)}
                  defaultOpen={e.id === latest}
                  href={gmailThreadUrl(accountEmail, e.threadId || e.id)}
                  move={move}
                />
              ))}
            </ol>
            {unlinked.length > 0 && <UnlinkedEmails emails={unlinked} />}
            {emails.length === 0 && (
              <p className="mt-4 text-[13.5px] text-text-tertiary">
                {gmail.connected
                  ? `No emails matched yet. An email is matched when its sender or subject mentions “${row.company}”.`
                  : "Connect Gmail in your profile to pull in emails for this application."}
              </p>
            )}
          </PageSection>}
        </div>}

        <aside
          className={cn(
            "flex w-full flex-col gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8",
            contacts.length === 0 && !row.notes && "lg:sticky lg:top-16",
          )}
        >
          <DetailsPanel row={row} />
          <CvPanel applicationId={row.id} tailored={loaderData.share.hasTailoredCv} />
          {loaderData.prep && <PrepPanel applicationId={row.id} prepared={loaderData.prep.prepared} />}
          {row.notes && <NotesPanel notes={row.notes} />}
          {contacts.length > 0 && (
            <SideBlock title="People to reach out to" aside={contacts.length}>
              <ContactList contacts={contacts} />
            </SideBlock>
          )}
        </aside>

        {row.description && (
          <div className={cn("lg:col-start-1", hasLead ? "lg:row-start-2" : "lg:row-start-1")}>
            <JobDescription text={row.description} source={source} highlights={loaderData.highlights} />
          </div>
        )}
      </div>
    </div>
  );
}
