import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/profile";
import { Button } from "~/components/atoms/button";
import { Input } from "~/components/atoms/input";
import { Switch } from "~/components/atoms/switch";
import { Section, stagger } from "~/components/molecules/terminal";
import { SettingsNav } from "~/components/molecules/settings-nav";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import {
  getProfile,
  saveProfile,
  type ProfileForm,
} from "~/server/db/profile.server";
import { GmailConnectButton, gmailStatusText } from "~/components/molecules/gmail-connect";
import { cn } from "~/lib/cn";
import { getGmailStatus } from "~/server/gmail/sync.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const [profile, gmail] = await Promise.all([
    getProfile(db, user.id),
    getGmailStatus(db, user.id),
  ]);
  return { profile, user, gmail };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const form = await request.formData();
  const payload = JSON.parse(
    String(form.get("profile") ?? "{}"),
  ) as ProfileForm;
  await saveProfile(getDb(env.DB), user.id, payload);
  return { ok: true };
}

const SECTIONS = [
  {
    n: "02",
    id: "personal",
    title: "Personal information",
    description: "Your name and how employers reach you.",
  },
  {
    n: "03",
    id: "address",
    title: "Address",
    description: "Used for postal fields on applications.",
  },
  {
    n: "04",
    id: "links",
    title: "Links",
    description: "Attached to auto-filled applications.",
  },
  {
    n: "05",
    id: "eligibility",
    title: "Work eligibility",
    description: "Right to work, sponsorship, and availability.",
  },
  {
    n: "06",
    id: "software-cv",
    title: "Software CV",
    description: "Used when applying to technical roles.",
  },
  {
    n: "07",
    id: "retail-cv",
    title: "Retail CV",
    description: "Used for retail, hospitality, and customer-facing roles.",
  },
  {
    n: "08",
    id: "integrations",
    title: "Integrations",
    description: "Third-party services connected to your account.",
  },
] as const;
const secN = (id: string) => SECTIONS.find((s) => s.id === id)!.n;

export default function ProfilePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [form, setForm] = useState<ProfileForm>(loaderData.profile);
  const [dirty, setDirty] = useState(false);
  const nav = useNavigation();
  const saving = nav.state === "submitting";
  const saved = actionData?.ok && nav.state === "idle" && !dirty;

  const p = form.personal;
  const elig = form.eligibility;
  const sw = form.softwareCV;
  const rt = form.retailCV;

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
      className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6"
    >
      <input type="hidden" name="profile" value={JSON.stringify(form)} />

      {/* ── [01] ─────────────────────────────────────────────────── */}
      <header
        className="rise flex flex-wrap items-end justify-between gap-6"
        style={stagger(0)}
      >
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[03]</b>Profile
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
            {displayName}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[13px] normal-case tracking-normal text-text-secondary">
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
          {saved && <span className="text-green-primary">Saved</span>}
          {dirty && !saving && (
            <span className="text-text-tertiary">Unsaved changes</span>
          )}
          <Button type="submit" size="medium" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      {/* ── Nav + sections ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <SettingsNav
            items={SECTIONS.map((s) => ({
              n: s.n,
              href: `#${s.id}`,
              label: s.title,
            }))}
          />
        </aside>

        <main className="flex flex-col gap-12">
          <Section
            n={secN("personal")}
            id="personal"
            title="Personal information"
            hint="Your name and how employers reach you."
            i={1}
          >
            <FieldGrid cols={2}>
              <Field label="First name">
                <Input
                  value={p.firstName}
                  onChange={(e) =>
                    setP("personal", { firstName: e.target.value })
                  }
                />
              </Field>
              <Field label="Last name">
                <Input
                  value={p.lastName}
                  onChange={(e) =>
                    setP("personal", { lastName: e.target.value })
                  }
                />
              </Field>
              <Field label="Email address">
                <Input
                  type="email"
                  value={p.email}
                  onChange={(e) => setP("personal", { email: e.target.value })}
                />
              </Field>
              <Field label="Phone number">
                <Input
                  type="tel"
                  value={p.phone}
                  onChange={(e) => setP("personal", { phone: e.target.value })}
                />
              </Field>
            </FieldGrid>
          </Section>

          <Section
            n={secN("address")}
            id="address"
            title="Address"
            hint="Used for postal fields on applications."
            i={2}
          >
            <div className="flex flex-col gap-4">
              <Field label="Address line 1">
                <Input
                  value={p.address.line1}
                  onChange={(e) => setAddr({ line1: e.target.value })}
                />
              </Field>
              <Field label="Address line 2 (optional)">
                <Input
                  value={p.address.line2}
                  onChange={(e) => setAddr({ line2: e.target.value })}
                />
              </Field>
              <FieldGrid cols={3}>
                <Field label="City">
                  <Input
                    value={p.address.city}
                    onChange={(e) => setAddr({ city: e.target.value })}
                  />
                </Field>
                <Field label="County / Region">
                  <Input
                    value={p.address.county}
                    onChange={(e) => setAddr({ county: e.target.value })}
                  />
                </Field>
                <Field label="Postcode">
                  <Input
                    value={p.address.postcode}
                    onChange={(e) => setAddr({ postcode: e.target.value })}
                  />
                </Field>
              </FieldGrid>
              <Field label="Country">
                <Input
                  value={p.address.country}
                  onChange={(e) => setAddr({ country: e.target.value })}
                />
              </Field>
            </div>
          </Section>

          <Section
            n={secN("links")}
            id="links"
            title="Links"
            hint="Attached to auto-filled applications."
            i={3}
          >
            <FieldGrid cols={2}>
              <Field label="LinkedIn">
                <Input
                  value={p.linkedin}
                  onChange={(e) =>
                    setP("personal", { linkedin: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/…"
                />
              </Field>
              <Field label="GitHub">
                <Input
                  value={p.github}
                  onChange={(e) => setP("personal", { github: e.target.value })}
                  placeholder="https://github.com/…"
                />
              </Field>
            </FieldGrid>
            <div className="mt-4">
              <Field label="Portfolio">
                <Input
                  value={p.portfolio}
                  onChange={(e) =>
                    setP("personal", { portfolio: e.target.value })
                  }
                  placeholder="https://…"
                />
              </Field>
            </div>
          </Section>

          <Section
            n={secN("eligibility")}
            id="eligibility"
            title="Work eligibility"
            hint="Right to work, sponsorship, and availability."
            i={4}
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              <div className="flex flex-col gap-4 normal-case">
                <Switch
                  checked={elig.rightToWork}
                  onCheckedChange={(v) =>
                    setP("eligibility", { rightToWork: v })
                  }
                  label="I have the right to work in the UK"
                />
                <Switch
                  checked={elig.requiresSponsorship}
                  onCheckedChange={(v) =>
                    setP("eligibility", { requiresSponsorship: v })
                  }
                  label="I require visa sponsorship"
                />
                <Switch
                  checked={elig.availableImmediately}
                  onCheckedChange={(v) =>
                    setP("eligibility", { availableImmediately: v })
                  }
                  label="Available to start immediately"
                />
              </div>
              <Field label="Notice period">
                <Input
                  value={elig.noticePeriod}
                  onChange={(e) =>
                    setP("eligibility", { noticePeriod: e.target.value })
                  }
                  placeholder="e.g. 2 weeks"
                />
              </Field>
            </div>
          </Section>

          <CvCard
            n={secN("software-cv")}
            id="software-cv"
            i={5}
            title="Software CV"
            hint="Used when applying to technical roles."
            value={sw}
            onChange={(patch) => setP("softwareCV", patch)}
            skillsPlaceholder="TypeScript, React, Node.js, Python…"
          />

          <CvCard
            n={secN("retail-cv")}
            id="retail-cv"
            i={6}
            title="Retail CV"
            hint="Used for retail, hospitality, and customer-facing roles."
            value={rt}
            onChange={(patch) => setP("retailCV", patch)}
            skillsPlaceholder="Customer Service, Cash Handling, Stock…"
          />

          <Section
            n={secN("integrations")}
            id="integrations"
            title="Integrations"
            hint="Third-party services connected to your account."
            i={7}
          >
            <div className="flex items-center justify-between gap-4 border border-stroke-secondary bg-bg-secondary px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center bg-bg-primary text-[12px] font-semibold text-text-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]">
                  G
                </div>
                <div>
                  <p className="text-text-primary">Gmail</p>
                  <p className="mt-0.5 font-sans text-[11.5px] normal-case tracking-normal text-text-secondary">
                    {gmailStatusText(loaderData.gmail)}
                  </p>
                </div>
              </div>
              <GmailConnectButton
                connected={loaderData.gmail.connected}
                broken={!!loaderData.gmail.lastError}
              />
            </div>
          </Section>
        </main>
      </div>
    </Form>
  );
}

// ── Local primitives ────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow !text-[10px]">{label}</span>
      {children}
    </label>
  );
}

function FieldGrid({
  cols,
  children,
}: {
  cols: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        cols === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

function CvCard({
  n,
  id,
  i,
  title,
  hint,
  value,
  onChange,
  skillsPlaceholder,
}: {
  n: string;
  id: string;
  i: number;
  title: string;
  hint: string;
  value: {
    summary: string;
    skills: string;
    coverLetter: string;
    salary: string;
  };
  onChange: (
    patch: Partial<{
      summary: string;
      skills: string;
      coverLetter: string;
      salary: string;
    }>,
  ) => void;
  skillsPlaceholder: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <Section n={n} id={id} title={title} hint={hint} i={i}>
      <div className="flex flex-col gap-4">
        <Field label="Profile summary">
          <textarea
            value={value.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
            rows={3}
            placeholder="One paragraph describing your background and strengths."
            className="w-full resize-y bg-bg-primary px-3 py-2 text-[13px] normal-case tracking-normal text-text-primary placeholder:text-text-tertiary [box-shadow:inset_0_0_0_1px_var(--stroke-primary)] focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--text-primary)]"
          />
        </Field>
        <FieldGrid cols={2}>
          <Field label="Skills (comma-separated)">
            <Input
              value={value.skills}
              onChange={(e) => onChange({ skills: e.target.value })}
              placeholder={skillsPlaceholder}
            />
          </Field>
          <Field label="Expected salary">
            <Input
              value={value.salary}
              onChange={(e) => onChange({ salary: e.target.value })}
              placeholder="45000"
            />
          </Field>
        </FieldGrid>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="inline-flex items-center gap-2 uppercase text-text-secondary transition-colors hover:text-text-primary"
          >
            <span
              className={cn(
                "inline-block transition-transform",
                showAdvanced && "rotate-90",
              )}
            >
              ▸
            </span>
            {showAdvanced ? "Hide" : "Show"} cover letter template
          </button>
          {showAdvanced && (
            <div className="mt-3">
              <Field label="Cover letter template">
                <textarea
                  value={value.coverLetter}
                  onChange={(e) => onChange({ coverLetter: e.target.value })}
                  rows={5}
                  placeholder="I am excited to apply for this role. My experience with…"
                  className="w-full resize-y bg-bg-primary px-3 py-2 text-[13px] normal-case tracking-normal text-text-primary placeholder:text-text-tertiary [box-shadow:inset_0_0_0_1px_var(--stroke-primary)] focus-visible:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--text-primary)]"
                />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
