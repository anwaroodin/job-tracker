import { ArrowUpRight, CalendarClock, Check, Ellipsis, Link2, Reply, Unlink } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { data, Link, useFetcher } from "react-router";
import type { Route } from "./+types/[id]";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/atoms/dropdown-menu";
import { Button } from "~/components/atoms/button";
import { GmailSync } from "~/components/molecules/gmail-sync";
import { NewBadge } from "~/components/molecules/new-badge";
import { Leader, STATUS_COLORS, Section, fmtDate, stagger } from "~/components/molecules/terminal";
import { StatusBadge } from "~/components/molecules/status-badge";
import { cn } from "~/lib/cn";
import { actionLabel, EMAIL_CATEGORIES, eventLabel, formatEventAt, isEmailCategory } from "~/lib/email";
import { gmailThreadUrl } from "~/lib/gmail";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication } from "~/server/db/applications.server";
import {
  getApplicationEmails,
  markReplyDone,
  markViewed,
  setEmailCategory,
  setEmailDismissed,
} from "~/server/db/emails.server";
import { getSettings } from "~/server/db/settings.server";
import { getGmailStatus, refreshApplicationStatus, syncGmail } from "~/server/gmail/sync.server";

const STAGES = ["applied", "screening", "assessment", "interview", "offer"] as const;
const OUTCOMES = new Set(["rejected", "accepted", "withdrawn", "ghosted"]);

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const settings = await getSettings(db, user.id);
  const [row, emails, gmail] = await Promise.all([
    getApplication(db, user.id, params.id),
    getApplicationEmails(db, user.id, params.id, settings.minConfidence),
    getGmailStatus(db, user.id),
  ]);
  if (!row) throw data("Not found", { status: 404 });
  const unseen = emails.filter((e) => !e.viewedAt && !e.dismissedAt).map((e) => e.id);
  if (unseen.length) await markViewed(db, user.id, unseen);
  return { row, emails, gmail, accountEmail: user.email };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const form = await request.formData();
  const intent = form.get("intent");
  const emailId = String(form.get("id"));
  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
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
  const { row, gmail, accountEmail } = loaderData;
  const isNew = useNewOnArrival(row.id, loaderData.emails);
  const emails = loaderData.emails.filter((e) => !e.dismissedAt);
  const unlinked = loaderData.emails.filter((e) => e.dismissedAt);
  const reached = new Set<string>([
    "applied",
    row.status,
    ...emails.filter((e) => !e.unsure).map((e) => e.category ?? ""),
  ]);

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <Link to="/applications" className="transition-colors hover:text-text-primary">
              [02] Applications
            </Link>
            <span className="mx-2 opacity-50">/</span>
            {row.company}
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            {row.company}
            <span className="block text-text-tertiary">{row.role}</span>
          </h1>
          <p className="mt-5">
            <StatusBadge status={row.status} />
          </p>
        </div>
        <GmailSync status={gmail} />
      </header>

      <Section n="02" title="Progress" i={1}>
        <ol className="grid grid-cols-5 gap-1">
          {STAGES.map((stage) => {
            const on = reached.has(stage);
            return (
              <li key={stage} className="flex min-w-0 flex-col gap-2">
                <span
                  aria-hidden
                  className="h-[3px] w-full"
                  style={{ background: on ? STATUS_COLORS[stage] : "rgba(255,255,255,0.08)" }}
                />
                <span
                  className={cn(
                    "truncate text-[10px] tracking-[0.08em] sm:text-[11px]",
                    stage === row.status ? "text-text-primary" : on ? "text-text-secondary" : "text-text-tertiary",
                  )}
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ol>
        {OUTCOMES.has(row.status) && (
          <p className="mt-4 text-[11px] tracking-[0.08em] text-text-tertiary">
            Outcome <StatusBadge status={row.status} className="ml-2" />
          </p>
        )}
      </Section>

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

      <Section n="04" title="Details" i={3}>
        <div className="grid grid-cols-1 gap-x-16 sm:grid-cols-2">
          <Leader label="Location">{row.location || "—"}</Leader>
          <Leader label="Work type">{row.workType || "—"}</Leader>
          <Leader label="Salary">{row.salary || "—"}</Leader>
          <Leader label="CV">{row.cvType}</Leader>
          <Leader label="Applied">{fmtDate(row.appliedAt)}</Leader>
          <Leader label="Updated">{fmtDate(row.updatedAt)}</Leader>
        </div>
        {row.notes && (
          <p className="mt-4 whitespace-pre-line font-sans text-[13px] normal-case tracking-normal text-text-secondary">
            {row.notes}
          </p>
        )}
      </Section>
    </div>
  );
}

type TimelineEmail = Route.ComponentProps["loaderData"]["emails"][number];

function useNewOnArrival(applicationId: string, emails: TimelineEmail[]) {
  const arrivals = useRef<{ applicationId: string; ids: Set<string> } | null>(null);
  if (arrivals.current?.applicationId !== applicationId) {
    arrivals.current = { applicationId, ids: new Set(emails.filter((e) => !e.viewedAt).map((e) => e.id)) };
  }
  const arrived = arrivals.current.ids;
  return (email: TimelineEmail) => arrived.has(email.id) || !email.viewedAt;
}

function EmailItem({ email, href, isNew }: { email: TimelineEmail; href: string; isNew: boolean }) {
  if (email.category === "deleted") {
    return (
      <TimelineItem category="deleted" title="Deleted from Gmail" actions={<EmailActions email={email} unlinkOnly />} />
    );
  }
  if (!email.category) {
    return (
      <TimelineItem
        category="pending"
        title="Email details not synced yet"
        meta="Open in Gmail"
        href={href}
        actions={<EmailActions email={email} unlinkOnly />}
      />
    );
  }
  return (
    <TimelineItem
      date={email.receivedAt ?? undefined}
      category={email.category}
      title={email.subject || "(no subject)"}
      from={email.fromName || email.fromAddress || undefined}
      snippet={email.snippet || undefined}
      meta="Open in Gmail"
      href={href}
      unread={isNew}
      unsure={email.unsure}
      edited={email.edited}
      confirmed={email.confirmed}
      needsReply={email.needsReply}
      footer={<EmailDetails email={email} />}
      actions={<EmailActions email={email} />}
    />
  );
}

function EmailDetails({ email }: { email: TimelineEmail }) {
  const fetcher = useFetcher();
  const replied = fetcher.formData?.get("intent") === "replied";
  const needsReply = email.needsReply && !replied;
  if (!email.eventAt && !email.actionUrl && !needsReply) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 text-[11px] tracking-[0.08em]">
      {email.eventAt && (
        <span className="flex items-center gap-1.5 text-text-primary" title={email.eventText ?? undefined}>
          <CalendarClock className="size-3.5 text-text-tertiary" />
          <span className="text-text-tertiary">{eventLabel(email.category ?? "")}</span>
          {formatEventAt(email.eventAt)}
        </span>
      )}
      {email.actionUrl && (
        <Button asChild variant="secondary" size="tiny">
          <a href={email.actionUrl} target="_blank" rel="noopener noreferrer" title={email.actionText ?? email.actionUrl}>
            {actionLabel(email.actionUrl, email.category ?? "")}
            <ArrowUpRight />
          </a>
        </Button>
      )}
      {needsReply && (
        <Button
          type="button"
          variant="ghost"
          size="tiny"
          onClick={() => fetcher.submit({ intent: "replied", id: email.id }, { method: "post" })}
        >
          <Check />
          Mark replied
        </Button>
      )}
    </div>
  );
}

function EmailActions({ email, unlinkOnly }: { email: TimelineEmail; unlinkOnly?: boolean }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const pendingCategory = fetcher.formData?.get("category");
  const current = typeof pendingCategory === "string" ? pendingCategory : email.category;
  const submit = (fields: Record<string, string>) => fetcher.submit({ id: email.id, ...fields }, { method: "post" });
  const confirm = () => submit({ intent: "categorize", category: email.category ?? "other" });
  const unsure = email.unsure && !unlinkOnly && fetcher.formData?.get("intent") !== "categorize";

  return (
    <div className="mt-2 flex shrink-0 items-center gap-1">
      {unsure && (
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          title={`Jev wasn't sure. Confirm this email really is ${email.category}.`}
          className="flex h-7 items-center gap-1.5 px-2 text-[10.5px] uppercase tracking-[0.1em] text-accent-primary transition-colors hover:bg-white/[0.06] hover:text-accent-secondary focus-visible:bg-white/[0.06] focus-visible:outline-none disabled:opacity-40"
        >
          <Check className="size-3.5" />
          Confirm
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Email actions"
            disabled={busy}
            className="flex size-7 shrink-0 items-center justify-center text-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-text-primary focus-visible:bg-white/[0.06] focus-visible:text-text-primary focus-visible:outline-none disabled:opacity-40 data-[state=open]:bg-white/[0.06] data-[state=open]:text-text-primary"
          >
            <Ellipsis className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 whitespace-nowrap font-mono uppercase tracking-[0.04em]">
          {!unlinkOnly && (
            <>
              {unsure && (
                <>
                  <DropdownMenuItem onSelect={confirm}>
                    <Check />
                    Confirm as {email.category}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuLabel>Mark as</DropdownMenuLabel>
              {EMAIL_CATEGORIES.map((category) => (
                <DropdownMenuItem
                  key={category}
                  disabled={category === current && !unsure}
                  onSelect={() => submit({ intent: "categorize", category })}
                >
                  <span
                    aria-hidden
                    className="size-[7px] shrink-0"
                    style={{ background: STATUS_COLORS[category] ?? "#6e6f76" }}
                  />
                  {category}
                  {category === current && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => submit({ intent: "unlink" })}>
            <Unlink />
            Unlink from application
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function UnlinkedEmails({ emails }: { emails: TimelineEmail[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="uppercase text-[11px] tracking-[0.08em] text-text-tertiary transition-colors hover:text-text-primary"
      >
        {emails.length} unlinked {emails.length === 1 ? "email" : "emails"} · {open ? "Hide" : "Show"}
      </button>
      {open && (
        <ul className="mt-3 flex flex-col gap-1">
          {emails.map((email) => (
            <UnlinkedEmail key={email.id} email={email} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UnlinkedEmail({ email }: { email: TimelineEmail }) {
  const fetcher = useFetcher();
  return (
    <li className="flex items-center gap-4 py-1.5">
      <span className="hidden w-[96px] shrink-0 text-[11px] tracking-[0.08em] text-text-tertiary sm:block">
        {email.receivedAt ? fmtDate(email.receivedAt) : "—"}
      </span>
      <span className="min-w-0 flex-1 truncate font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
        {email.subject || "(no subject)"}
      </span>
      <button
        type="button"
        disabled={fetcher.state !== "idle"}
        onClick={() => fetcher.submit({ intent: "relink", id: email.id }, { method: "post" })}
        className="flex shrink-0 items-center gap-1.5 uppercase text-[10.5px] tracking-[0.1em] text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-40"
      >
        <Link2 className="size-3.5" />
        Relink
      </button>
    </li>
  );
}

function TimelineItem({
  date,
  category,
  title,
  from,
  snippet,
  meta,
  href,
  unread,
  unsure,
  edited,
  confirmed,
  needsReply,
  actions,
  footer,
}: {
  date?: string;
  category: string;
  title: string;
  from?: string;
  snippet?: string;
  meta?: string;
  href?: string;
  unread?: boolean;
  unsure?: boolean;
  edited?: boolean;
  confirmed?: boolean;
  needsReply?: boolean;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const color = STATUS_COLORS[category] ?? "#6e6f76";
  const body = (
    <>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tracking-[0.08em]">
        <span className="text-text-tertiary sm:hidden">{date ? fmtDate(date) : "—"}</span>
        <span style={{ color }}>[{category}]</span>
        {unread && <NewBadge className="self-center" />}
        {needsReply && (
          <span className="flex items-center gap-1 text-text-primary">
            <Reply className="size-3" />
            Reply needed
          </span>
        )}
        {unsure && (
          <span
            className="text-accent-primary"
            title="The classifier wasn't sure, so this email didn't change the status"
          >
            Unsure
          </span>
        )}
        {edited && <span className="text-text-tertiary">Edited</span>}
        {confirmed && <span className="text-text-tertiary">Confirmed</span>}
      </p>
      <p className="mt-1.5 font-sans text-[14px] normal-case tracking-normal text-text-primary">{title}</p>
      {from && (
        <p className="mt-0.5 truncate font-sans text-[12px] normal-case tracking-normal text-text-tertiary">{from}</p>
      )}
      {snippet && (
        <p className="mt-2 line-clamp-2 font-sans text-[12.5px] normal-case leading-relaxed tracking-normal text-text-secondary">
          {snippet}
        </p>
      )}
      {meta && href && (
        <p className="mt-2 text-[10.5px] tracking-[0.1em] text-text-tertiary transition-colors group-hover:text-text-primary">
          {meta} ↗
        </p>
      )}
    </>
  );

  return (
    <li className="grid grid-cols-[14px_1fr] gap-x-4 sm:grid-cols-[96px_14px_1fr]">
      <span className="hidden pt-[13px] text-[11px] tracking-[0.08em] text-text-tertiary sm:block">
        {date ? fmtDate(date) : "—"}
      </span>
      <span aria-hidden className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px bg-white/10" />
        <span className="relative mt-[15px] size-[9px]" style={{ background: color }} />
      </span>
      <div
        className={cn(
          "-mx-3 my-1 flex min-w-0 items-start gap-1 px-3 transition-colors",
          unread && "bg-green-quaternary shadow-[inset_2px_0_0_var(--color-green-primary)]",
          href && "hover:bg-white/[0.04] has-[a:focus-visible]:bg-white/[0.04] has-[[data-state=open]]:bg-white/[0.04]",
        )}
      >
        <div className="min-w-0 flex-1">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block py-2.5 focus-visible:outline-none"
            >
              {body}
            </a>
          ) : (
            <div className="py-2.5">{body}</div>
          )}
          {footer}
        </div>
        {actions}
      </div>
    </li>
  );
}
