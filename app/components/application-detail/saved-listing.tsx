import { ArrowUpRight, Check, FileText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { ContactList } from "~/components/application-detail/contact-list";
import { FlagToggle } from "~/components/applications/flag-toggle";
import { FactChips, listingFacts } from "~/components/application-detail/fact-chips";
import { RichText } from "~/components/ui/rich-text";
import { StatusBadge } from "~/components/ui/status-badge";
import { Leader, Section, fmtDate, stagger } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { parseContacts } from "~/lib/contacts";
import { hostOf } from "~/lib/format/url";
import type { SavedListingJob } from "~/types/application";

/**
 * A saved posting laid out as the job listing it was captured from: the
 * headline facts and apply actions up top, the full description below, and
 * the captured details in a side column.
 */
export function SavedListing({ job }: { job: SavedListingJob }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const act = (fields: Record<string, string>) => fetcher.submit(fields, { method: "post" });
  const source = hostOf(job.url);
  const contacts = parseContacts(job.contactsJson);

  useEffect(() => {
    if (!confirmingRemove) return;
    const timer = setTimeout(() => setConfirmingRemove(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmingRemove]);

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise flex flex-col gap-6" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <Link to="/applications" className="transition-colors hover:text-text-primary">
            [02] Applications
          </Link>
          <span className="mx-2 opacity-50">/</span>
          Saved
          <span className="mx-2 opacity-50">/</span>
          {job.company}
        </p>

        <div className="min-w-0">
          <p className="flex items-center gap-4 text-[11px] tracking-[0.1em]">
            <StatusBadge status={job.status} />
            <FlagToggle id={job.id} status={job.status} flagged={job.starred} />
          </p>
          <h1 className="mt-4 max-w-3xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary normal-case sm:text-[30px]">
            {job.role}
            <span className="block uppercase text-text-tertiary">{job.company}</span>
          </h1>
          <FactChips facts={listingFacts(job)} className="mt-5" />
        </div>

        <div className={cn("flex flex-wrap items-center gap-2", busy && "opacity-60")}>
          {job.url && (
            <Button asChild>
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                Open & apply
                <ArrowUpRight />
              </a>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link to={`/applications/${job.id}/cv`}>
              <FileText />
              Tailor CV
            </Link>
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => act({ intent: "saved-applied" })}>
            <Check />
            Mark applied
          </Button>
          {confirmingRemove ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => act({ intent: "saved-remove" })}
              >
                <Trash2 />
                Confirm remove
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmingRemove(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmingRemove(true)}
              className="text-text-tertiary hover:text-red-primary"
            >
              <Trash2 />
              Remove
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Sticky while it's short enough to fit on screen; with people listed it scrolls with the page. */}
        <aside
          className={cn(
            "flex flex-col gap-12 w-full lg:self-start lg:col-start-2 lg:row-start-1",
            contacts.length === 0 && "lg:sticky lg:top-16",
          )}
        >
          <Section n="02" title="Details" i={1}>
            <Leader label="Location">{job.location || "—"}</Leader>
            <Leader label="Work type">{job.workType || "—"}</Leader>
            <Leader label="Employment">{job.employmentType || "—"}</Leader>
            <Leader label="Salary">{job.salary || "—"}</Leader>
            <Leader label="Posted">{job.postedAt ? fmtDate(job.postedAt) : "—"}</Leader>
            {job.applicants && <Leader label="Applicants">{job.applicants}</Leader>}
            <Leader label="Level">{job.category || "—"}</Leader>
            <Leader label="CV">{job.cvType}</Leader>
            <Leader label="Saved">{fmtDate(job.appliedAt)}</Leader>
            {source && (
              <Leader label="Source">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="normal-case text-accent-primary transition-colors hover:text-accent-secondary"
                >
                  {source} ↗
                </a>
              </Leader>
            )}
          </Section>
        </aside>

        <div className="lg:col-start-1 lg:row-start-1">
          <Section n="03" title="Job description" hint={source || undefined} i={2}>
            {job.description ? (
              <RichText text={job.description} />
            ) : (
              <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
                No description was captured with this posting.{" "}
                {job.url && "Open the posting with the extension installed and it's filled in once the page loads it."}
              </p>
            )}
          </Section>
        </div>

        {contacts.length > 0 && (
          <div className="lg:col-start-2 lg:row-start-2">
            <Section n="04" title="People to reach out to" hint={String(contacts.length)} i={3}>
              <ContactList contacts={contacts} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
