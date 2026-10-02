import { useState } from "react";
import { data, useFetcher, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/settings";
import type { loader as layoutLoader } from "./layout";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { GmailConnectButton, gmailStatusText } from "~/components/gmail/gmail-connect";
import { GmailSync } from "~/components/gmail/gmail-sync";
import { SettingsNav } from "~/components/ui/settings-nav";
import { Leader, Section, stagger } from "~/components/ui/terminal";
import { parseSettings, type Settings } from "~/lib/settings";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getSettings, saveSettings } from "~/server/db/queries/settings.server";
import { reclassifyEstimate } from "~/server/db/queries/usage.server";
import { jevAvailable } from "~/server/email/classify/index.server";
import { requestReclassify } from "~/server/db/queries/gmail-sync.server";
import { syncGmail } from "~/server/gmail/sync/index.server";
import { refreshApplicationStatus } from "~/server/services/status/refresh.server";
import { Setting } from "~/components/settings/setting-row";
import { ReclassifyAll } from "~/components/settings/reclassify-all";
import { SignOutButton } from "~/components/settings/sign-out-button";
import { ClassificationSection } from "~/components/settings/classification-section";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [settings, estimate] = await Promise.all([
    getSettings(db, user.id),
    reclassifyEstimate(db, user.id),
  ]);
  return { user, settings, estimate, jevAvailable: jevAvailable(env) };
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
  { n: "02", id: "classification", title: "Email classification" },
  { n: "03", id: "gmail", title: "Gmail" },
  { n: "04", id: "data", title: "Data" },
  { n: "05", id: "account", title: "Account" },
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
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[05]</b>Settings
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            Settings
            <span className="block text-text-tertiary">How job-tracker reads your inbox.</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-green-primary">Saved</span>}
          {dirty && !saving && <span className="text-text-tertiary">Unsaved changes</span>}
          <Button type="button" size="medium" disabled={saving || !dirty || budgetInvalid} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <SettingsNav items={SECTIONS.map((s) => ({ n: s.n, href: `#${s.id}`, label: s.title }))} />
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

          <Section n="03" id="gmail" title="Gmail" hint="where emails come from" i={2}>
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
          </Section>

          <Section n="04" id="data" title="Data" hint="stored emails" i={3}>
            <ReclassifyAll
              emails={estimate.emails}
              cost={estimate.cost}
              usesJev={loaderData.jevAvailable && loaderData.settings.classifier === "jev"}
              connected={gmail.connected}
            />
          </Section>

          <Section n="05" id="account" title="Account" i={4}>
            <Leader label="Name">{user.name || "—"}</Leader>
            <Leader label="Email">
              <span className="normal-case">{user.email}</span>
            </Leader>
            <div className="mt-5">
              <SignOutButton />
            </div>
          </Section>
        </main>
      </div>

      {dirty && (
        <aside
          aria-label="Unsaved changes"
          className="fixed bottom-6 right-6 z-30 flex items-center gap-4 border border-stroke-primary bg-bg-secondary/95 px-5 py-3 shadow-xl backdrop-blur-sm sm:right-10"
        >
          <span className="text-[11px] text-text-tertiary">Unsaved changes</span>
          <Button
            type="button"
            size="medium"
            disabled={saving || budgetInvalid}
            onClick={save}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </aside>
      )}
    </div>
  );
}
