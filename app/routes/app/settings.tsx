import { useState } from "react";
import { data, useFetcher, useNavigate } from "react-router";
import type { Route } from "./+types/settings";
import { Button } from "~/components/atoms/button";
import { Input } from "~/components/atoms/input";
import { Switch } from "~/components/atoms/switch";
import { GmailConnectButton, gmailStatusText } from "~/components/molecules/gmail-connect";
import { GmailSync } from "~/components/molecules/gmail-sync";
import { SettingsNav } from "~/components/molecules/settings-nav";
import { Leader, Section, stagger } from "~/components/molecules/terminal";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { CONFIDENCE_LEVELS, formatDollars, parseSettings, type Classifier, type Settings } from "~/lib/settings";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getSettings, saveSettings } from "~/server/db/settings.server";
import { reclassifyEstimate } from "~/server/db/usage.server";
import { jevAvailable } from "~/server/email/classifier.server";
import {
  getGmailStatus,
  refreshApplicationStatus,
  requestReclassify,
  syncGmail,
  type SyncResult,
} from "~/server/gmail/sync.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [settings, gmail, estimate] = await Promise.all([
    getSettings(db, user.id),
    getGmailStatus(db, user.id),
    reclassifyEstimate(db, user.id),
  ]);
  return { user, settings, gmail, estimate, jevAvailable: jevAvailable(env) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
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
    if (next.minConfidence !== previous.minConfidence) await refreshApplicationStatus(db, user.id);
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
  const { user, gmail, estimate } = loaderData;
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
          <Section n="02" id="classification" title="Email classification" hint="how emails get a stage" i={1}>
            <div className="flex flex-col gap-7">
              <Setting
                label="Classifier"
                description={
                  loaderData.jevAvailable
                    ? "Jev reads each email and says which stage it's about. The regex rules are free but miss unusual wording. Switching reclassifies your stored emails on the next sync."
                    : "Jev isn't available: TYPESAFE_API_KEY is not set, or EMAIL_CLASSIFIER is set to regex. The regex rules are used."
                }
              >
                <Segmented<Classifier>
                  label="Classifier"
                  options={[
                    { value: "jev", label: "Jev" },
                    { value: "regex", label: "Regex" },
                  ]}
                  value={loaderData.jevAvailable ? form.classifier : "regex"}
                  disabled={!loaderData.jevAvailable}
                  onChange={(classifier) => update({ classifier })}
                />
              </Setting>

              <Setting
                label="Confidence threshold"
                description="Below this, Jev's answer is marked unsure and won't change an application's status. Higher is more careful."
              >
                <Segmented<number>
                  label="Confidence threshold"
                  options={CONFIDENCE_LEVELS.map((level) => ({ value: level, label: `${Math.round(level * 100)}%` }))}
                  value={form.minConfidence}
                  onChange={(minConfidence) => update({ minConfidence })}
                />
              </Setting>

              <Setting
                label="Read the full email when unsure"
                description="Fetches the body of low-confidence emails from Gmail and asks Jev again. Costs a little more; sends that email's body to TypeSafe."
              >
                <Switch checked={form.readBodies} onCheckedChange={(readBodies) => update({ readBodies })} />
              </Setting>

              <Setting
                label="Pull out dates, links and replies"
                description="For interview, assessment and offer emails, finds the interview time or deadline, the meeting or assessment link, and whether they're waiting on your reply. Reads those emails in full and sends them to TypeSafe."
              >
                <Switch checked={form.extractDetails} onCheckedChange={(extractDetails) => update({ extractDetails })} />
              </Setting>

              <Setting
                label="Suggest untracked applications"
                description="Spots confirmation emails for jobs you haven't added yet and suggests them on the Applications page, with the company and role filled in."
              >
                <Switch
                  checked={form.suggestApplications}
                  onCheckedChange={(suggestApplications) => update({ suggestApplications })}
                />
              </Setting>

              <Setting
                label="Monthly budget"
                description="Once Jev spend reaches this, new emails use the regex rules until next month. Leave empty for no limit."
              >
                <div className="flex w-40 items-center gap-2">
                  <span className="text-text-tertiary">$</span>
                  <Input
                    inputMode="decimal"
                    placeholder="No limit"
                    value={budgetText}
                    aria-invalid={budgetInvalid}
                    className={cn(budgetInvalid && "border-red-primary hover:border-red-primary")}
                    onChange={(e) => {
                      setBudgetText(e.target.value);
                      const amount = Number(e.target.value);
                      update({ monthlyBudget: e.target.value.trim() === "" || !(amount >= 0) ? null : amount });
                    }}
                  />
                </div>
                {budgetInvalid && (
                  <p className="mt-1.5 font-sans text-[12px] normal-case tracking-normal text-red-primary">
                    Enter an amount like 5 or 2.50
                  </p>
                )}
              </Setting>
            </div>
          </Section>

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
    </div>
  );
}

function Setting({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <div className="max-w-md">
        <p className="text-text-primary">{label}</p>
        <p className="mt-1 font-sans text-[12.5px] normal-case leading-relaxed tracking-normal text-text-secondary">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex border border-stroke-primary", disabled && "opacity-40")}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 px-3.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors [&+&]:border-l [&+&]:border-stroke-primary",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-text-secondary",
              selected ? "bg-text-primary text-text-inverse" : "bg-fill-secondary text-text-secondary hover:bg-fill-primary hover:text-text-primary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ReclassifyAll({
  emails,
  cost,
  usesJev,
  connected,
}: {
  emails: number;
  cost: number;
  usesJev: boolean;
  connected: boolean;
}) {
  const fetcher = useFetcher<{ reclassify?: SyncResult }>();
  const running = fetcher.state !== "idle";
  const result = running ? undefined : fetcher.data?.reclassify;
  return (
    <Setting
      label="Reclassify all emails"
      description={
        connected
          ? `Runs the current classifier over ${emails} stored ${emails === 1 ? "email" : "emails"} and updates statuses. ` +
            (usesJev ? `Roughly ${formatDollars(cost)} with Jev. ` : "") +
            "Emails you've corrected by hand are left alone."
          : "Connect Gmail first. Reclassifying runs as part of a Gmail sync."
      }
    >
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={running || emails === 0 || !connected}
          onClick={() => fetcher.submit({ intent: "reclassify" }, { method: "post" })}
        >
          {running ? "Reclassifying…" : "Reclassify"}
        </Button>
        {result && (
          <span
            className={cn(
              "max-w-56 text-[10.5px] tracking-[0.08em] sm:text-right",
              result.error ? "text-red-primary" : result.busy ? "text-text-tertiary" : "text-green-primary",
            )}
          >
            {result.error ?? (result.busy ? "A sync just ran. It'll reclassify on the next one." : "Done")}
          </span>
        )}
      </div>
    </Setting>
  );
}

function SignOutButton() {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant="destructive"
      size="small"
      onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => navigate("/auth/login") } })}
    >
      Sign out
    </Button>
  );
}
