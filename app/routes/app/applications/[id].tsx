import { data, Link, redirect, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/[id]";
import type { loader as layoutLoader } from "../layout";
import { ContactList } from "~/components/application-detail/contact-list";
import { FactChips, listingFacts } from "~/components/application-detail/fact-chips";
import { FlagToggle } from "~/components/applications/flag-toggle";
import { GmailSync } from "~/components/gmail/gmail-sync";
import { JobDescription } from "~/components/application-detail/job-description";
import { SavedListing } from "~/components/application-detail/saved-listing";
import { Leader, Section, fmtDate, stagger } from "~/components/ui/terminal";
import { StatusBadge } from "~/components/ui/status-badge";
import { cn } from "~/lib/cn";
import { parseContacts } from "~/lib/contacts";
import { isEmailCategory } from "~/lib/email";
import { gmailThreadUrl } from "~/lib/gmail";
import { hostOf } from "~/lib/format/url";
import { useArrivals } from "~/hooks/use-arrivals";
import { requireUser } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication, updateApplication } from "~/server/db/queries/applications.server";
import { settleSavedJob } from "~/server/services/status/saved.server";
import { markReplyDone, markViewed, setEmailCategory, setEmailDismissed } from "~/server/db/queries/emails.server";
import { getApplicationEmails } from "~/server/services/timeline/index.server";
import { getSettings } from "~/server/db/queries/settings.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { TimelineItem } from "~/components/application-detail/timeline-item";
import { EmailItem } from "~/components/application-detail/email-item";
import { UnlinkedEmails } from "~/components/application-detail/unlinked-emails";
import { useNewOnArrival } from "~/components/application-detail/use-new-on-arrival";
import { Progress } from "~/components/application-detail/progress";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const settings = await getSettings(db, user.id);
  const [row, emails] = await Promise.all([
    getApplication(db, user.id, params.id),
    getApplicationEmails(db, user.id, params.id, settings.minConfidence),
  ]);
  if (!row) throw data("Not found", { status: 404 });
  const unseen = emails.filter((e) => !e.viewedAt && !e.dismissedAt).map((e) => e.id);
  if (unseen.length) await markViewed(db, user.id, unseen);
  return { row, emails, accountEmail: user.email };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
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
  if (intent === "saved-applied" || intent === "saved-remove") {
    const outcome = intent === "saved-remove" ? "removed" : "applied";
    if (!(await settleSavedJob(db, user.id, params.id, outcome))) throw data("Not a saved posting", { status: 400 });
    return outcome === "removed" ? redirect("/applications") : { ok: true };
  }
  if (intent === "replied") {
    await markReplyDone(db, user.id, emailId);
    return { ok: true };
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
  // A saved posting hasn't been applied to yet: show it as the job listing.
  if (loaderData.row.status === "saved") return <SavedListing job={loaderData.row} />;
  return <TrackedApplication loaderData={loaderData} />;
}

function TrackedApplication({ loaderData }: Pick<Route.ComponentProps, "loaderData">) {
  const { row, accountEmail } = loaderData;
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const isNew = useNewOnArrival(row.id, loaderData.emails);
  const isArrival = useArrivals(
    loaderData.emails.map((e) => e.id),
    row.id,
  );
  const emails = loaderData.emails.filter((e) => !e.dismissedAt);
  const unlinked = loaderData.emails.filter((e) => e.dismissedAt);
  const reached = new Set<string>([
    "applied",
    row.status,
    ...emails.filter((e) => !e.unsure).map((e) => e.category ?? ""),
  ]);
  const source = hostOf(row.url);
  const contacts = parseContacts(row.contactsJson);

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise flex flex-col gap-6" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <Link to="/applications" className="transition-colors hover:text-text-primary">
            [02] Applications
          </Link>
          <span className="mx-2 opacity-50">/</span>
          {row.company}
        </p>

        <div className="min-w-0">
          <h1 className="max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            {row.company}
            <span className="block text-text-tertiary">{row.role}</span>
          </h1>
          <FactChips facts={listingFacts(row)} className="mt-5" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-4 text-[11px] tracking-[0.1em]">
            <StatusBadge status={row.status} />
            <FlagToggle id={row.id} status={row.status} flagged={row.starred} />
          </p>
          <GmailSync status={gmail} />
        </div>
      </header>

      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-12 lg:col-start-1 lg:row-start-1">
          <Progress status={row.status} reached={reached} />

          <Section
            n="03"
            title="Timeline"
            hint={emails.length ? `${emails.length} ${emails.length === 1 ? "email" : "emails"}` : undefined}
            i={2}
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
                  href={gmailThreadUrl(accountEmail, e.threadId || e.id)}
                />
              ))}
            </ol>
            {unlinked.length > 0 && <UnlinkedEmails emails={unlinked} />}
            {emails.length === 0 && (
              <p className="mt-4 font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
                {gmail.connected
                  ? `No emails matched yet. An email is matched when its sender or subject mentions “${row.company}”.`
                  : "Connect Gmail in your profile to pull in emails for this application."}
              </p>
            )}
          </Section>
        </div>

        {/* Sticky while it's short enough to fit on screen; with people listed it scrolls with the page. */}
        <aside
          className={cn(
            "flex flex-col gap-12 self-start lg:col-start-2 lg:row-start-1",
            contacts.length === 0 && "lg:sticky lg:top-16",
          )}
        >
          <Section n="04" title="Details" i={3}>
            <Leader label="Location">{row.location || "—"}</Leader>
            <Leader label="Work type">{row.workType || "—"}</Leader>
            {row.employmentType && <Leader label="Employment">{row.employmentType}</Leader>}
            <Leader label="Salary">{row.salary || "—"}</Leader>
            {row.postedAt && <Leader label="Posted">{fmtDate(row.postedAt)}</Leader>}
            {row.applicants && <Leader label="Applicants">{row.applicants}</Leader>}
            {row.category && <Leader label="Level">{row.category}</Leader>}
            <Leader label="CV">{row.cvType}</Leader>
            <Leader label="Applied">{fmtDate(row.appliedAt)}</Leader>
            <Leader label="Updated">{fmtDate(row.updatedAt)}</Leader>
            {source && (
              <Leader label="Source">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="normal-case text-accent-primary transition-colors hover:text-accent-secondary"
                >
                  {source} ↗
                </a>
              </Leader>
            )}
            {row.notes && (
              <p className="mt-4 whitespace-pre-line font-sans text-[13px] normal-case tracking-normal text-text-secondary">
                {row.notes}
              </p>
            )}
          </Section>
        </aside>

        {row.description && (
          <div className="lg:col-start-1 lg:row-start-2">
            <Section n="05" title="Job description" hint={source || undefined} i={4}>
              <JobDescription text={row.description} />
            </Section>
          </div>
        )}

        {contacts.length > 0 && (
          <div className="lg:col-start-2 lg:row-start-2">
            <Section n="06" title="People to reach out to" hint={String(contacts.length)} i={5}>
              <ContactList contacts={contacts} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
