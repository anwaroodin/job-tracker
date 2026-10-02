import { data, redirect, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/index";
import type { loader as layoutLoader } from "../layout";
import { useState } from "react";
import { NewApplication } from "~/components/applications/new-application";
import { GmailSync } from "~/components/gmail/gmail-sync";
import { Section, stagger } from "~/components/ui/terminal";
import { requireUser } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { createApplication } from "~/server/db/queries/applications.server";
import { listApplications } from "~/server/services/applications/list.server";
import { applicationSuggestions } from "~/server/services/applications/suggestions.server";
import { settleSavedJob } from "~/server/services/status/saved.server";
import { dismissSuggestions, linkEmailsToApplication, unreadEmailCounts } from "~/server/db/queries/emails.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { useArrivals } from "~/hooks/use-arrivals";
import { OffersBanner } from "~/components/applications/offers-banner";
import { SuggestionsBanner } from "~/components/applications/suggestions-banner";
import { SavedSection } from "~/components/applications/saved-section";
import { TableToolbar } from "~/components/applications/table-toolbar";
import { ApplicationsTable } from "~/components/applications/applications-table";
import { useApplicationsView } from "~/components/applications/use-applications-view";

const MAX_FIELD_LENGTH = 200;

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [apps, unread, suggestions] = await Promise.all([
    listApplications(db, user.id),
    unreadEmailCounts(db, user.id),
    applicationSuggestions(db, user.id),
  ]);
  const saved = apps.filter((a) => a.status === "saved");
  const rows = apps.filter((a) => a.status !== "saved").map((a) => ({ ...a, unread: unread[a.id] ?? 0 }));
  return { rows, saved, suggestions, accountEmail: user.email };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
  const db = getDb(env.DB);
  const emailIds = String(form.get("emailIds") ?? "").split(",").filter(Boolean);

  if (intent === "saved-applied" || intent === "saved-remove") {
    const applicationId = String(form.get("applicationId") ?? "");
    const outcome = intent === "saved-remove" ? "removed" : "applied";
    if (!(await settleSavedJob(db, user.id, applicationId, outcome))) return { error: "Not a saved posting" };
    return { ok: true };
  }
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

  if (intent !== "create" && intent !== "track") throw data("Unknown intent", { status: 400 });
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
  if (intent === "create") return redirect(`/applications/${id}`);
  await linkEmailsToApplication(db, user.id, id, emailIds);
  await refreshApplicationStatus(db, user.id, id);
  return { ok: true };
}

export default function Applications({ loaderData }: Route.ComponentProps) {
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const rows = loaderData.rows;
  const saved = loaderData.saved;
  const suggestions = loaderData.suggestions;
  const view = useApplicationsView(rows);
  const { total, activeCount, offersList, offersCount, closedCount, filteredItems } = view;
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isArrival = useArrivals([
    ...rows.map((r) => r.id),
    ...saved.map((s) => s.id),
  ]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 font-mono text-[12.5px] uppercase tracking-[0.04em]">
      {/* ── [01] Applications Header ──────────────────────────────────────────── */}
      <header className="rise flex flex-wrap items-end justify-between gap-4 sm:gap-6" style={stagger(0)}>
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[01]</b>
            Applications
          </p>
          <h1 className="mt-3 sm:mt-5 max-w-2xl text-[22px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
            <span className="text-text-primary">{total} applications logged.</span>
            <span className="block text-text-tertiary">
              {activeCount} in flight, {offersCount} {offersCount === 1 ? "offer" : "offers"},{" "}
              {closedCount} closed.
            </span>
          </h1>
        </div>

        {/* Action cluster on the right */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto sm:ml-auto">
          <GmailSync status={gmail} />
          <NewApplication />
        </div>
      </header>

      {offersCount > 0 && <OffersBanner offersList={offersList} offersCount={offersCount} />}

      {suggestions.length > 0 && (
        <SuggestionsBanner
          suggestions={suggestions}
          accountEmail={loaderData.accountEmail}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
        />
      )}

      <SavedSection saved={saved} isArrival={isArrival} />

      {/* ── [03] Tracked Applications Section ───────────────── */}
      <Section
        n="03"
        title="Tracked applications"
        hint={`${filteredItems.length} matching`}
        i={2}
      >
        <div className="flex flex-col gap-4">
          <TableToolbar view={view} />
          <ApplicationsTable view={view} gmail={gmail} isArrival={isArrival} />
        </div>
      </Section>
    </div>
  );
}
