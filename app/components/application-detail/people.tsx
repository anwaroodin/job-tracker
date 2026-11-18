import { ArrowUpRight01Icon, Copy01Icon, Loading03Icon, Mail01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { SideBlock } from "~/components/ui/side-block";
import { DomainField, FindPeople, LinkedInSearchLinks } from "./people-forms";
import { cn } from "~/lib/cn";
import { type EmailSource, type EmailStatus, isEmailStatus } from "~/lib/contacts";
import { gmailComposeUrl } from "~/lib/gmail";
import { isRecruiterRole, linkedInPeopleSearch, outreachDraft, type Sender } from "~/lib/outreach";
import type { ContactRow } from "~/types/application";

export interface Outreach {
  applicationId: string;
  accountEmail: string;
  senderName: string;
  company: string;
  role: string;
  domain: string;
}

const EMAIL_STATUS: Record<EmailStatus, { label: string; dot: string; hint: string }> = {
  valid: { label: "Verified", dot: "bg-green-primary", hint: "The company's mail server accepts this address." },
  accept_all: { label: "Likely", dot: "bg-accent-primary", hint: "This company accepts every address, so this is based on its email format." },
  likely: { label: "Likely", dot: "bg-accent-primary", hint: "Uses this company's known email format. Its mail server couldn't be checked." },
  unknown: { label: "Unverified", dot: "bg-text-tertiary", hint: "Built from the company's email format, but the mail server couldn't be checked." },
  blocked: { label: "Unverified", dot: "bg-text-tertiary", hint: "The company's mail server wouldn't answer the check." },
  not_found: { label: "Not found", dot: "bg-red-primary", hint: "None of the usual formats exist at this company." },
};

const COPIED_MS = 2000;

const HIRING_NOTE =/job poster|hiring team|recruit/i;

const SMALL_GHOST = "h-7 gap-1.5 px-2 font-sans text-[12.5px] normal-case tracking-normal text-text-secondary hover:bg-ink/[0.04] hover:text-text-primary";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

const cleanHeadline = (raw: string) =>
  raw
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s*[•·|]\s*/g, " · ")
    .replace(/^[•·|\s-]+|[•·|\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function PeoplePanel({ contacts, senders, outreach }: { contacts: ContactRow[]; senders: Sender[]; outreach: Outreach }) {
  const hiringTeam = contacts.filter((contact) => contact.source === "linkedin");
  const found = contacts.filter((contact) => contact.source !== "linkedin");
  const count = contacts.length + senders.length;
  const groups: [string, ContactRow[]][] = [
    ["Hiring team", hiringTeam],
    ["Hiring managers", found.filter((contact) => contact.headline && !isRecruiterRole(contact.headline))],
    ["Recruiters", found.filter((contact) => isRecruiterRole(contact.headline))],
    [`Others at ${outreach.company}`, found.filter((contact) => !contact.headline)],
  ];

  return (
    <SideBlock title="People" aside={count || undefined}>
      {count === 0 && (
        <p className="text-[13px] leading-relaxed text-text-tertiary">
          No one yet. Recruiters who email you about this job show up here, and so does the hiring team when the extension sees it on LinkedIn.
        </p>
      )}
      {count > 0 && (
        <div className="-mx-2 flex flex-col">
          {senders.length > 0 && (
            <Group title="Emailed you">
              {senders.map((sender) => (
                <Person key={sender.email} name={sender.name} subtitle={sender.email}>
                  <EmailActions email={sender.email} name={sender.name} outreach={outreach} />
                </Person>
              ))}
            </Group>
          )}
          {groups.map(
            ([title, people]) =>
              people.length > 0 && (
                <Group key={title} title={title}>
                  {people.map((contact) => (
                    <HiringContact key={contact.id} contact={contact} outreach={outreach} />
                  ))}
                </Group>
              ),
          )}
        </div>
      )}
      {hiringTeam.length === 0 && <FindPeople company={outreach.company} again={found.length > 0} />}
      <LinkedInSearchLinks outreach={outreach} />
      {contacts.length > 0 && <DomainField domain={outreach.domain} />}
    </SideBlock>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col pb-1">
      <p className="px-2 pb-1 pt-2 text-[12px] font-medium text-text-tertiary">{title}</p>
      {children}
    </div>
  );
}

function Person({ name, subtitle, trailing, children }: { name: string; subtitle?: string; trailing?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-2 py-2 hover:bg-ink/[0.04]">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/[0.05] text-[12px] font-medium text-text-secondary">
        {initials(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[13.5px] font-medium text-text-primary" title={name}>
            {name}
          </p>
          {trailing}
        </div>
        {subtitle && (
          <p className="truncate text-[12.5px] text-text-tertiary" title={subtitle}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

function HiringContact({ contact, outreach }: { contact: ContactRow; outreach: Outreach }) {
  const fetcher = useFetcher<{ error?: string }>();
  const finding = fetcher.state !== "idle";
  const status = isEmailStatus(contact.emailStatus) ? contact.emailStatus : null;
  const hiringNote = HIRING_NOTE.test(contact.note) ? contact.note.replace(/\s*[•·].*$/, "").trim() : "";
  const subtitle = (contact.source === "linkedin" ? [hiringNote, cleanHeadline(contact.headline)] : [cleanHeadline(contact.headline), contact.note]).filter(Boolean).join(" · ");

  const profileLink = (
    <a
      href={contact.profileUrl || linkedInPeopleSearch(contact.name, outreach.company)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] text-text-tertiary hover:text-text-primary"
    >
      LinkedIn
      <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
    </a>
  );

  return (
    <Person name={contact.name} subtitle={subtitle} trailing={profileLink}>
      {contact.email && status && <EmailStatusLine email={contact.email} status={status} source={contact.emailSource} />}
      {contact.email && <EmailActions email={contact.email} name={contact.name} outreach={outreach} />}
      {(!contact.email || status === "unknown" || status === "blocked") && (
        <fetcher.Form method="post" className="-ml-2 flex items-center gap-2">
          <input type="hidden" name="intent" value="find-email" />
          <input type="hidden" name="contactId" value={contact.id} />
          <Button type="submit" variant="ghost" disabled={finding} className={SMALL_GHOST}>
            <HugeiconsIcon icon={finding ? Loading03Icon : Search01Icon} size={14} strokeWidth={1.5} className={cn(finding && "animate-spin")} />
            {finding ? "Checking addresses…" : status === "not_found" ? "Try again" : contact.email ? "Check again" : "Find email"}
          </Button>
          {!finding && status === "not_found" && <span className="text-[12.5px] text-text-tertiary">No address found</span>}
        </fetcher.Form>
      )}
      {fetcher.data?.error && <p className="text-[12.5px] text-red-primary">{fetcher.data.error}</p>}
    </Person>
  );
}

const EMAIL_SOURCE: Record<EmailSource, string> = {
  checker: "checked by your mail server",
  format: "company's email format",
  guess: "common format, not checked",
  generect: "from Generect",
};

function EmailStatusLine({ email, status, source }: { email: string; status: EmailStatus; source: string | null }) {
  const { label, dot, hint } = EMAIL_STATUS[status];
  const via = source && source in EMAIL_SOURCE ? EMAIL_SOURCE[source as EmailSource] : undefined;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-secondary" title={hint}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">{email}</span>
      <span className="shrink-0 text-text-tertiary">· {label}{via && ` · ${via}`}</span>
    </p>
  );
}

function EmailActions({ email, name, outreach }: { email: string; name: string; outreach: Outreach }) {
  const [copied, setCopied] = useState(false);
  const draft = outreachDraft(outreach, name, outreach.senderName);
  const copy = async () => {
    const done = await navigator.clipboard.writeText(email).then(() => true, () => false);
    setCopied(done);
    if (done) setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className="-ml-2 flex items-center gap-0.5">
      <Button asChild variant="ghost" className={SMALL_GHOST}>
        <a href={gmailComposeUrl(outreach.accountEmail, { to: email, ...draft })} target="_blank" rel="noopener noreferrer">
          <HugeiconsIcon icon={Mail01Icon} size={14} strokeWidth={1.5} />
          Email
        </a>
      </Button>
      <Button type="button" variant="ghost" onClick={copy} className={SMALL_GHOST}>
        <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={14} strokeWidth={1.5} />
        {copied ? "Copied" : "Copy address"}
      </Button>
    </div>
  );
}
