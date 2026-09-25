import type { Route } from "./+types/index";
import { Button } from "~/components/atoms/button";
import { ApplicationDataTable } from "~/components/organisms/application-data-table";
import { ApplicationSuggestions } from "~/components/organisms/application-suggestions";
import { GmailSync } from "~/components/molecules/gmail-sync";
import { Section, stagger } from "~/components/molecules/terminal";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import {
  createApplication,
  listApplications,
} from "~/server/db/applications.server";
import {
  applicationSuggestions,
  dismissSuggestions,
  linkEmailsToApplication,
  unreadEmailCounts,
} from "~/server/db/emails.server";
import { getGmailStatus, refreshApplicationStatus, syncGmail } from "~/server/gmail/sync.server";

const MAX_FIELD_LENGTH = 200;
const HIDDEN = new Set(["rejected", "ghosted", "withdrawn"]);
const ACTIVE = new Set(["applied", "screening", "interview", "assessment"]);
const OFFERED = new Set(["offer", "accepted"]);

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [apps, unread, gmail, suggestions] = await Promise.all([
    listApplications(db, user.id),
    unreadEmailCounts(db, user.id),
    getGmailStatus(db, user.id),
    applicationSuggestions(db, user.id),
  ]);
  const rows = apps.map((a) => ({ ...a, unread: unread[a.id] ?? 0 }));
  return { rows, gmail, suggestions, accountEmail: user.email };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
  const db = getDb(env.DB);
  const emailIds = String(form.get("emailIds") ?? "").split(",").filter(Boolean);

  if (intent === "dismiss-suggestion") {
    await dismissSuggestions(db, user.id, emailIds);
    return { ok: true };
  }
  if (intent === "link-suggestion") {
    const applicationId = String(form.get("applicationId") ?? "");
    await linkEmailsToApplication(db, user.id, applicationId, emailIds);
    await refreshApplicationStatus(db, user.id, applicationId);
    return { ok: true };
  }

  const company = String(form.get("company") ?? "").trim().slice(0, MAX_FIELD_LENGTH);
  const role = String(form.get("role") ?? "").trim().slice(0, MAX_FIELD_LENGTH);
  if (!company || !role) return { error: "Company and role are required" };
  const appliedAt = new Date(String(form.get("appliedAt") ?? ""));
  const id = crypto.randomUUID();
  await createApplication(db, {
    id,
    userId: user.id,
    company,
    role,
    autoFilled: false,
    ...(intent === "track" && !Number.isNaN(appliedAt.getTime()) ? { appliedAt: appliedAt.toISOString() } : {}),
  });
  if (intent === "track") {
    await linkEmailsToApplication(db, user.id, id, emailIds);
    await refreshApplicationStatus(db, user.id, id);
  }
  return { ok: true };
}

export default function Applications({ loaderData }: Route.ComponentProps) {
  const rows = loaderData.rows;
  const total = rows.length;
  const active = rows.filter((r) => ACTIVE.has(r.status)).length;
  const offers = rows.filter((r) => OFFERED.has(r.status)).length;
  const closed = rows.filter((r) => HIDDEN.has(r.status)).length;
  const suggestions = loaderData.suggestions;
  const hasSuggestions = suggestions.length > 0;

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      {/* ── [01] ─────────────────────────────────────────────────── */}
      <header
        className="rise flex flex-wrap items-end justify-between gap-6"
        style={stagger(0)}
      >
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[02]</b>
            Applications
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
            <span className="text-text-primary">
              {total} applications logged.
            </span>
            <span className="block text-text-tertiary">
              {active} in flight, {offers} {offers === 1 ? "offer" : "offers"},{" "}
              {closed} closed.
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <GmailSync status={loaderData.gmail} />
          <Button type="button">+ New application</Button>
        </div>
      </header>

      {hasSuggestions && (
        <Section
          n="02"
          title="From your inbox"
          hint={`${suggestions.length} untracked ${suggestions.length === 1 ? "application" : "applications"}`}
          i={1}
        >
          <ApplicationSuggestions suggestions={suggestions} accountEmail={loaderData.accountEmail} />
        </Section>
      )}

      <Section n={hasSuggestions ? "03" : "02"} title="Records" hint="filter, search, sort" i={2}>
        <ApplicationDataTable rows={rows} />
      </Section>
    </div>
  );
}
