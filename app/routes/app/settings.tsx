import { useState } from "react";
import { data, useFetcher, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/settings";
import type { loader as layoutLoader } from "./layout";
import { Button } from "~/components/ui/button";
import { UnsavedBar } from "~/components/ui/unsaved-bar";
import { Switch } from "~/components/ui/switch";
import { GmailConnectButton, gmailStatusText } from "~/components/gmail/gmail-connect";
import { GmailSync } from "~/components/gmail/gmail-sync";
import { SettingsNav } from "~/components/ui/settings-nav";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { stagger, PageTitle } from "~/components/ui/terminal";
import { parseSettings, type Settings } from "~/lib/settings";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getSettings, saveSettings } from "~/server/db/queries/settings.server";
import { reclassifyEstimate } from "~/server/db/queries/usage.server";
import { jevAvailable } from "~/server/email/classify/index.server";
import { requestReclassify, updateSyncState } from "~/server/db/queries/gmail-sync.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { Setting } from "~/components/settings/setting-row";
import { ReclassifyAll } from "~/components/settings/reclassify-all";
import { SignOutButton } from "~/components/settings/sign-out-button";
import { ClassificationSection } from "~/components/settings/classification-section";
import { SharedLinks } from "~/components/settings/shared-links";
import { ThemeSetting } from "~/components/settings/theme-setting";
import { activeShareLinks } from "~/server/db/queries/share-links.server";
import { tailoredApplicationIds } from "~/server/db/queries/tailored-cv.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [settings, estimate, links, tailored] = await Promise.all([
    getSettings(db, user.id),
    reclassifyEstimate(db, user.id),
    activeShareLinks(db, user.id, new Date().toISOString()),
    tailoredApplicationIds(db, user.id),
  ]);
  const shared = links.map((l) => ({ ...l, hasTailoredCv: tailored.has(l.applicationId) }));
  return { user, settings, estimate, shared, jevAvailable: jevAvailable(env) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "sync") return { sync: await syncGmail(env, user.id, "manual") };
  if (intent === "reclassify") {
    await requestReclassify(db, user.id);
    return { reclassify: await syncGmail(env, user.id, "manual") };
  }
  if (intent === "save") {
    const previous = await getSettings(db, user.id);
    const next = parseSettings(parseJson(form.get("settings")));
    await saveSettings(db, user.id, next);
    await updateSyncState(db, user.id, { matchedAt: null });
    if (next.minConfidence !== previous.minConfidence) await refreshApplicationStatus(db, user.id, undefined, next.minConfidence);
    return { saved: true };
  }
  throw data("Unknown intent", { status: 400 });
}

function parseJson(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value));
  } catch {
    throw data("Invalid settings", { status: 400 });
  }
}

const SECTIONS = [
  { id: "classification", title: "Email classification" },
  { id: "gmail", title: "Gmail" },
  { id: "data", title: "Data" },
  { id: "sharing", title: "Shared links" },
  { id: "appearance", title: "Appearance" },
  { id: "account", title: "Account" },
] as const;

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const { user, estimate } = loaderData;
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const [form, setForm] = useState<Settings>(loaderData.settings);
  const [budgetText, setBudgetText] = useState(form.monthlyBudget?.toString() ?? "");
  const [dirty, setDirty] = useState(false);
  const budgetInvalid = budgetText.trim() !== "" && !(Number(budgetText) >= 0);
  const saver = useFetcher<{ saved?: boolean }>();
  const saving = saver.state !== "idle";
  const saved = saver.state === "idle" && saver.data?.saved && !dirty;

  const update = (patch: Partial<Settings>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const save = () => {
    saver.submit({ intent: "save", settings: JSON.stringify(form) }, { method: "post" });
    setDirty(false);
  };

  return (
    <div className={`flex flex-col gap-10 ${SANS_PAGE}`}>
      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <PageTitle title="Settings" sub="How j*b reads your inbox, and your account." />
        <div className="flex items-center gap-4">
          {saved && <span className="text-[13.5px] text-green-primary">Saved</span>}
          {dirty && !saving && <span className="text-[13.5px] text-text-tertiary">Unsaved changes</span>}
          <Button type="button" size="medium" disabled={saving || !dirty || budgetInvalid} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <SettingsNav items={SECTIONS.map((s) => ({ href: `#${s.id}`, label: s.title }))} />
        </aside>

        <main className="flex flex-col gap-12">
          <ClassificationSection
            form={form}
            update={update}
            jevAvailable={loaderData.jevAvailable}
            budgetText={budgetText}
            setBudgetText={setBudgetText}
            budgetInvalid={budgetInvalid}
          />

          <PageSection id="gmail" title="Gmail" description="Where your emails come from.">
            <div className="flex flex-col gap-7">
              <Setting label="Connection" description={gmailStatusText(gmail)}>
                <GmailConnectButton
                  connected={gmail.connected}
                  broken={!!gmail.lastError}
                  callbackURL="/settings#gmail"
                />
              </Setting>
              <Setting
                label="Sync automatically"
                description="Checks Gmail every 30 minutes and when you open the app. You can always sync by hand."
              >
                <Switch checked={form.autoSync} onCheckedChange={(autoSync) => update({ autoSync })} />
              </Setting>
              {gmail.connected && <GmailSync status={gmail} />}
            </div>
          </PageSection>

          <PageSection id="data" title="Data" description="The emails j*b has stored.">
            <ReclassifyAll
              emails={estimate.emails}
              cost={estimate.cost}
              usesJev={loaderData.jevAvailable && loaderData.settings.classifier === "jev"}
              connected={gmail.connected}
            />
          </PageSection>

          <PageSection id="sharing" title="Shared links" description="Applications you've shared with a link.">
            <SharedLinks links={loaderData.shared} />
          </PageSection>

          <PageSection id="appearance" title="Appearance">
            <ThemeSetting />
          </PageSection>

          <PageSection id="account" title="Account">
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-y-2.5">
              <dt className="text-text-tertiary">Name</dt>
              <dd className="text-text-primary">{user.name || "—"}</dd>
              <dt className="text-text-tertiary">Email</dt>
              <dd className="truncate text-text-primary">{user.email}</dd>
            </dl>
            <div className="mt-5">
              <SignOutButton />
            </div>
          </PageSection>
        </main>
      </div>

      {dirty && (
        <UnsavedBar>
          <Button
            type="button"
            size="medium"
            disabled={saving || budgetInvalid}
            onClick={save}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </UnsavedBar>
      )}
    </div>
  );
}
