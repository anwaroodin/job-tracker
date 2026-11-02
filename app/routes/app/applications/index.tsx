import { useEffect, useMemo } from "react";
import { data, redirect, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/index";
import type { loader as layoutLoader } from "../layout";
import { ApplicationsBoard } from "~/components/applications/applications-board";
import { ApplicationsHeader } from "~/components/applications/applications-header";
import { ApplicationsTable } from "~/components/applications/applications-table";
import { FromGmail } from "~/components/applications/from-gmail";
import { LayoutToggle } from "~/components/applications/layout-toggle";
import { SavedSection } from "~/components/applications/saved-section";
import { SearchField } from "~/components/applications/table-toolbar";
import { StatusFilter } from "~/components/applications/status-filter";
import { CLOSED_TAB_STATUSES, useApplicationsView } from "~/components/applications/use-applications-view";
import { selectedView, ViewTabs } from "~/components/applications/view-tabs";
import { Section } from "~/components/ui/terminal";
import { useArrivals } from "~/hooks/use-arrivals";
import { usePersisted } from "~/hooks/use-persisted";
import { APPLICATION_STATUSES } from "~/lib/status";
import { applicationsLayout$ } from "~/lib/state/applications-layout";
import { sidebarView$ } from "~/lib/state/sidebar-view";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { createApplication } from "~/server/db/queries/applications.server";
import { tailoredApplicationIds } from "~/server/db/queries/tailored-cv.server";
import { listApplications } from "~/server/services/applications/list.server";
import { applicationSuggestions } from "~/server/services/applications/suggestions.server";
import { settleSavedJob } from "~/server/services/status/saved.server";
import { dismissSuggestions, linkEmailsToApplication, setEmailCategory } from "~/server/db/queries/emails.server";
import { confirmNotAboutJobs, emailsToConfirm } from "~/server/email/retention.server";
import { isEmailCategory } from "~/lib/email";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";

const MAX_FIELD_LENGTH = 200;

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const applicationsQuery = listApplications(db, user.id);
  const [listed, suggestions, unsure, tailored] = await Promise.all([
    applicationsQuery,
    applicationSuggestions(db, user.id, applicationsQuery),
    emailsToConfirm(db, user.id),
    tailoredApplicationIds(db, user.id),
  ]);
  const apps = listed.map((a) => ({ ...a, tailored: tailored.has(a.id) }));
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
  const { saved, suggestions, unsure } = loaderData;
  const [params] = useSearchParams();
  const selected = selectedView(params);
  const view = useApplicationsView(rows, selected === "closed" ? "closed" : "open");
  const board = usePersisted(() => applicationsLayout$.board.get(), false);
  const sidebarCollapsed = usePersisted(() => sidebarView$.collapsed.get(), false);
  const isArrival = useArrivals([...rows.map((r) => r.id), ...saved.map((s) => s.id)]);

  const { setPage, setStatus } = view;
  useEffect(() => {
    setStatus(null);
    setPage(0);
  }, [selected, setPage, setStatus]);

  const inView = rows.filter((r) => CLOSED_TAB_STATUSES.has(r.status) === (selected === "closed"));
  const statusOptions = APPLICATION_STATUSES.map((status) => ({
    status,
    count: inView.filter((r) => r.status === status).length,
  })).filter((o) => o.count > 0);

  return (
    <div className="flex flex-col gap-6 font-mono text-[12.5px] uppercase tracking-[0.04em] sm:gap-8">
      <ApplicationsHeader
        total={view.total}
        activeCount={view.activeCount}
        offersCount={view.offersCount}
        closedCount={view.closedCount}
        gmail={gmail}
        stats={false}
      />

      <FromGmail suggestions={suggestions} unsure={unsure} accountEmail={loaderData.accountEmail} />

      <div className="flex flex-col gap-4">
        <ViewTabs className={sidebarCollapsed ? undefined : "lg:hidden"} />

        {selected === "saved" ? (
          <SavedSection n="02" saved={saved} isArrival={isArrival} />
        ) : (
          <Section
            n="02"
            title={selected === "open" ? "Open applications" : "Closed applications"}
            hint={
              <span className="flex flex-wrap items-center gap-3">
                <SearchField view={view} className="normal-case tracking-normal" />
                <StatusFilter
                  options={statusOptions}
                  value={view.status}
                  onChange={(status) => {
                    setStatus(status);
                    setPage(0);
                  }}
                />
                {view.filteredItems.length} matching
                <LayoutToggle board={board} />
              </span>
            }
            i={2}
          >
            {board ? (
              <ApplicationsBoard items={view.filteredItems} tab={view.activeTab} />
            ) : (
              <ApplicationsTable view={view} gmail={gmail} isArrival={isArrival} />
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
