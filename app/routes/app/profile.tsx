import { useState } from "react";
import { Form, useNavigation, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/profile";
import type { loader as layoutLoader } from "./layout";
import { Button } from "~/components/ui/button";
import { UnsavedBar } from "~/components/ui/unsaved-bar";
import { stagger, PageTitle } from "~/components/ui/terminal";
import { SettingsNav } from "~/components/ui/settings-nav";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import {
  getProfile,
  saveProfile,
} from "~/server/db/queries/profile.server";
import type { ProfileForm } from "~/types/profile";
import { PersonalSection } from "~/components/profile/personal-section";
import { AddressSection } from "~/components/profile/address-section";
import { LinksSection } from "~/components/profile/links-section";
import { EligibilitySection } from "~/components/profile/eligibility-section";
import { IntegrationsSection } from "~/components/profile/integrations-section";
import { SECTIONS } from "~/components/profile/sections";
import { SANS_PAGE } from "~/components/ui/page-section";
import { publishedExtension } from "~/server/extension/download.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [profile, extensionUpdatedAt] = await Promise.all([getProfile(db, user.id), publishedExtension(env.CVS)]);
  return { profile, user, extensionUpdatedAt };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const form = await request.formData();
  const payload = JSON.parse(
    String(form.get("profile") ?? "{}"),
  ) as ProfileForm;
  await saveProfile(getDb(env.DB), user.id, payload);
  return { ok: true };
}

export default function ProfilePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const [form, setForm] = useState<ProfileForm>(loaderData.profile);
  const [dirty, setDirty] = useState(false);
  const nav = useNavigation();
  const saving = nav.state === "submitting";
  const saved = actionData?.ok && nav.state === "idle" && !dirty;

  const p = form.personal;
  const elig = form.eligibility;

  const setP = <K extends keyof ProfileForm>(
    section: K,
    patch: Partial<ProfileForm[K]>,
  ) => {
    setForm((f) => ({ ...f, [section]: { ...f[section], ...patch } }));
    setDirty(true);
  };
  const setAddr = (patch: Partial<ProfileForm["personal"]["address"]>) => {
    setForm((f) => ({
      ...f,
      personal: { ...f.personal, address: { ...f.personal.address, ...patch } },
    }));
    setDirty(true);
  };

  const displayName =
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    loaderData.user.name ||
    "Your profile";

  return (
    <Form
      method="post"
      onSubmit={() => setDirty(false)}
      className={`flex flex-col gap-10 ${SANS_PAGE}`}
    >
      <input type="hidden" name="profile" value={JSON.stringify(form)} />

      <header
        className="rise flex flex-wrap items-end justify-between gap-6"
        style={stagger(0)}
      >
        <div>
          <PageTitle title={displayName} />
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-text-secondary">
            <span>{loaderData.user.email}</span>
            {p.address.city && <span className="text-text-tertiary">·</span>}
            {p.address.city && (
              <span>
                {[p.address.city, p.address.country].filter(Boolean).join(", ")}
              </span>
            )}
            {p.phone && <span className="text-text-tertiary">·</span>}
            {p.phone && <span className="tabular-nums">{p.phone}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saved && <span className="text-[13.5px] text-green-primary">Saved</span>}
          {dirty && !saving && <span className="text-[13.5px] text-text-tertiary">Unsaved changes</span>}
          <Button type="submit" size="medium" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <SettingsNav
            items={SECTIONS.map((s) => ({
              href: `#${s.id}`,
              label: s.title,
            }))}
          />
        </aside>

        <main className="flex flex-col gap-12">
          <PersonalSection value={p} onChange={(patch) => setP("personal", patch)} />

          <AddressSection value={p.address} onChange={setAddr} />

          <LinksSection value={p} onChange={(patch) => setP("personal", patch)} />

          <EligibilitySection value={elig} onChange={(patch) => setP("eligibility", patch)} />

          <IntegrationsSection gmail={gmail} extensionUpdatedAt={loaderData.extensionUpdatedAt} />
        </main>
      </div>

      {dirty && (
        <UnsavedBar>
          <Button type="submit" size="medium" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </UnsavedBar>
      )}
    </Form>
  );
}

