import { data, Link, useFetcher } from "react-router";
import type { Route } from "./+types/[id]";
import { GmailSync } from "~/components/molecules/gmail-sync";
import { Leader, STATUS_COLORS, Section, fmtDate, stagger } from "~/components/molecules/terminal";
import { StatusBadge } from "~/components/molecules/status-badge";
import { cn } from "~/lib/cn";
import { gmailThreadUrl } from "~/lib/gmail";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication } from "~/server/db/applications.server";
import { getApplicationEmails, markViewed } from "~/server/db/emails.server";
import { getGmailStatus, syncGmail } from "~/server/gmail/sync.server";

const STAGES = ["applied", "screening", "assessment", "interview", "offer"] as const;
const OUTCOMES = new Set(["rejected", "accepted", "withdrawn", "ghosted"]);

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [row, emails, gmail] = await Promise.all([
    getApplication(db, user.id, params.id),
    getApplicationEmails(db, user.id, params.id),
    getGmailStatus(db, user.id),
  ]);
  if (!row) throw data("Not found", { status: 404 });
  return { row, emails, gmail, accountEmail: user.email };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
  if (intent === "viewed") {
    await markViewed(getDb(env.DB), user.id, [String(form.get("id"))]);
    return { ok: true };
  }
  throw data("Unknown intent", { status: 400 });
}

export default function ApplicationDetail({ loaderData }: Route.ComponentProps) {
  const { row, emails, gmail, accountEmail } = loaderData;
  const reached = new Set<string>(["applied", row.status, ...emails.map((e) => e.category ?? "")]);

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
            <EmailItem key={e.id} email={e} href={gmailThreadUrl(accountEmail, e.threadId || e.id)} />
          ))}
        </ol>
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

function EmailItem({ email, href }: { email: TimelineEmail; href: string }) {
  const fetcher = useFetcher();
  const unread = !email.viewedAt && fetcher.state === "idle" && !fetcher.data;

  if (email.category === "deleted") {
    return <TimelineItem category="deleted" title="Deleted from Gmail" />;
  }
  if (!email.category) {
    return <TimelineItem category="pending" title="Email details not synced yet" meta="Open in Gmail" href={href} />;
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
      unread={unread}
      onOpen={
        email.viewedAt
          ? undefined
          : () => fetcher.submit({ intent: "viewed", id: email.id }, { method: "post" })
      }
    />
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
  onOpen,
}: {
  date?: string;
  category: string;
  title: string;
  from?: string;
  snippet?: string;
  meta?: string;
  href?: string;
  unread?: boolean;
  onOpen?: () => void;
}) {
  const color = STATUS_COLORS[category] ?? "#6e6f76";
  const body = (
    <>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tracking-[0.08em]">
        <span className="text-text-tertiary sm:hidden">{date ? fmtDate(date) : "—"}</span>
        <span style={{ color }}>[{category}]</span>
        {unread && <span className="text-green-primary">New</span>}
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
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className="group -mx-3 my-1 block min-w-0 px-3 py-2.5 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none"
        >
          {body}
        </a>
      ) : (
        <div className="my-1 min-w-0 py-2.5">{body}</div>
      )}
    </li>
  );
}
