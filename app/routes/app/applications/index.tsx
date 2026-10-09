import { data, redirect, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/index";
import type { loader as layoutLoader } from "../layout";
import { useMemo, useState } from "react";
import { ApplicationsHeader } from "~/components/applications/applications-header";
import { Section } from "~/components/ui/terminal";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { createApplication } from "~/server/db/queries/applications.server";
import { listApplications } from "~/server/services/applications/list.server";
import { applicationSuggestions } from "~/server/services/applications/suggestions.server";
import { settleSavedJob } from "~/server/services/status/saved.server";
import { dismissSuggestions, linkEmailsToApplication, setEmailCategory } from "~/server/db/queries/emails.server";
import { confirmNotAboutJobs, emailsToConfirm } from "~/server/email/retention.server";
import { isEmailCategory } from "~/lib/email";
import { UnsureEmailsBanner } from "~/components/applications/unsure-emails-banner";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { useArrivals } from "~/hooks/use-arrivals";
import { OffersBanner } from "~/components/applications/offers-banner";
import { SuggestionsBanner } from "~/components/applications/suggestions-banner";
import { LogoCredit } from "~/components/applications/company-logo";
import { SavedSection } from "~/components/applications/saved-section";
import { TableToolbar } from "~/components/applications/table-toolbar";
import { ApplicationsTable } from "~/components/applications/applications-table";
import { useApplicationsView } from "~/components/applications/use-applications-view";

const MAX_FIELD_LENGTH = 200;

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const applicationsQuery = listApplications(db, user.id);
  const [apps, suggestions, unsure] = await Promise.all([
    applicationsQuery,
    applicationSuggestions(db, user.id, applicationsQuery),
    emailsToConfirm(db, user.id),
  ]);
  const saved = apps.filter((a) => a.status === "saved");
  const rows = apps.filter((a) => a.status !== "saved");
  return { rows, saved, suggestions, unsure, accountEmail: user.email };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
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
  if (intent === "not-job") {
    await confirmNotAboutJobs(env, db, user.id, String(form.get("id")));
    return { ok: true };
  }
  if (intent === "label-email") {
    const category = form.get("category");
    if (!isEmailCategory(category)) throw data("Unknown category", { status: 400 });
    await setEmailCategory(db, user.id, String(form.get("id")), category);
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
  const { gmail, unread } = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!;
  const rows = useMemo(
    () => loaderData.rows.map((a) => ({ ...a, unread: unread[a.id] ?? 0 })),
    [loaderData.rows, unread],
  );
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
      <ApplicationsHeader
        total={total}
        activeCount={activeCount}
        offersCount={offersCount}
        closedCount={closedCount}
        gmail={gmail}
      />

      {offersCount > 0 && <OffersBanner offersList={offersList} offersCount={offersCount} />}

      {suggestions.length > 0 && (
        <SuggestionsBanner
          suggestions={suggestions}
          accountEmail={loaderData.accountEmail}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
        />
      )}

      {loaderData.unsure.length > 0 && <UnsureEmailsBanner emails={loaderData.unsure} />}

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
          <LogoCredit />
        </div>
      </Section>
    </div>
  );
}
