import { ArrowRight01Icon, BookOpen01Icon, CheckmarkCircle02Icon, Mail01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { Form, Link, useNavigation } from "react-router";
import { GmailConnectButton } from "~/components/gmail/gmail-connect";
import { Field, FieldGrid } from "~/components/profile/field";
import { Wordmark } from "~/components/shell/wordmark";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SANS_PAGE } from "~/components/ui/page-section";
import { stagger } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import type { GmailStatus } from "~/types/gmail";
import type { ProfileForm } from "~/types/profile";
import { LESSON_IDS, LESSONS } from "./lessons";

export const SETUP_STEPS = ["intro", "details", "gmail", "done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
const LABELS: Record<SetupStep, string> = { intro: "Welcome", details: "Your details", gmail: "Gmail", done: "Ready" };


interface Props {
  step: SetupStep;
  user: { name?: string | null; email: string };
  personal: ProfileForm["personal"];
  gmail: GmailStatus;
}

function Stages({ at }: { at: number }) {
  return (
    <ol aria-label={`Step ${at + 1} of ${SETUP_STEPS.length}`} className="grid" style={{ gridTemplateColumns: `repeat(${SETUP_STEPS.length}, minmax(0, 1fr))` }}>
      {SETUP_STEPS.map((s, i) => {
        const reached = i <= at;
        return (
          <li key={s} className="flex min-w-0 flex-col gap-2.5" aria-current={i === at ? "step" : undefined}>
            <span aria-hidden className="flex items-center">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full border-2",
                  i < at ? "border-green-primary bg-green-primary" : i === at ? "border-text-primary bg-text-primary ring-4 ring-ink/[0.07]" : "border-stroke-primary bg-bg-primary",
                )}
              />
              {i < SETUP_STEPS.length - 1 && <span className={cn("mx-1.5 h-0.5 flex-1", i < at ? "bg-green-primary" : "bg-stroke-secondary")} />}
            </span>
            <span
              className={cn(
                "truncate pr-2 text-[13.5px]",
                i === at ? "font-medium text-text-primary" : reached ? "text-text-secondary" : "text-text-tertiary",
                i !== at && "max-sm:hidden",
              )}
            >
              {LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SetupScreen({ step, user, personal, gmail }: Props) {
  const at = SETUP_STEPS.indexOf(step);
  return (
    <div className={cn("fixed inset-0 z-[60] overflow-y-auto bg-bg-primary", SANS_PAGE)}>
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <Wordmark className="h-7 w-auto" />
          {step !== "done" && (
            <Form method="post">
              <Button type="submit" name="intent" value="skip" variant="ghost" className="text-text-tertiary">
                Skip setup
              </Button>
            </Form>
          )}
        </header>

        <div className="mt-10">
          <Stages at={at} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={step}
            className="flex flex-1 flex-col justify-center py-12"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === "intro" && <Intro name={personal.firstName || user.name?.split(" ")[0] || ""} />}
            {step === "details" && <Details user={user} personal={personal} />}
            {step === "gmail" && <Gmail gmail={gmail} />}
            {step === "done" && <Done connected={gmail.connected} />}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Heading({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-lg">
      <h1 className="text-[26px] font-medium leading-tight text-text-primary sm:text-[30px]">{title}</h1>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}

function Tile({ icon }: { icon: IconSvgElement }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center bg-ink/[0.05] text-text-secondary">
      <HugeiconsIcon icon={icon} size={18} strokeWidth={1.5} />
    </span>
  );
}

const PLAN: { icon: IconSvgElement; title: string; text: string }[] = [
  { icon: UserIcon, title: "Your details", text: "Used to fill in application forms" },
  { icon: Mail01Icon, title: "Gmail", text: "So job emails update your applications" },
  { icon: BookOpen01Icon, title: "Short lessons", text: "Whenever you want them" },
];

function Intro({ name }: { name: string }) {
  return (
    <div>
      <Heading title={name ? `Welcome, ${name}` : "Welcome"}>
        j*b keeps every application in one place and updates it from your inbox. Two quick things and you're in. Both can be changed or skipped.
      </Heading>
      <ul className="mt-8 flex flex-col border border-stroke-secondary">
        {PLAN.map(({ icon, title, text }, i) => (
          <li key={title} className="rise flex items-center gap-3 border-b border-stroke-secondary px-3 py-3 last:border-b-0" style={stagger(3 + i * 2)}>
            <Tile icon={icon} />
            <div className="min-w-0">
              <p className="font-medium text-text-primary">{title}</p>
              <p className="text-[12.5px] text-text-tertiary">{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Button asChild>
          <Link to="?step=details">
            Let's go
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Details({ user, personal }: Pick<Props, "user" | "personal">) {
  const saving = useNavigation().state !== "idle";
  const [first = "", ...rest] = (user.name ?? "").split(" ");
  return (
    <Form method="post">
      <Heading title="The basics">The extension uses these to fill in application forms. The rest of your profile can wait.</Heading>
      <div className="mt-8">
        <FieldGrid cols={2}>
          <Field label="First name">
            <Input name="firstName" defaultValue={personal.firstName || first} autoComplete="given-name" autoFocus className="h-9 text-[14px]" />
          </Field>
          <Field label="Last name">
            <Input name="lastName" defaultValue={personal.lastName || rest.join(" ")} autoComplete="family-name" className="h-9 text-[14px]" />
          </Field>
          <Field label="Contact email">
            <Input name="email" type="email" defaultValue={personal.email || user.email} autoComplete="email" className="h-9 text-[14px]" />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={personal.phone} autoComplete="tel" className="h-9 text-[14px]" />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={personal.address.city} autoComplete="address-level2" className="h-9 text-[14px]" />
          </Field>
          <Field label="Country">
            <Input name="country" defaultValue={personal.address.country} autoComplete="country-name" className="h-9 text-[14px]" />
          </Field>
        </FieldGrid>
      </div>
      <div className="mt-8 flex items-center gap-2">
        <Button type="submit" name="intent" value="details" disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
        <Button asChild variant="ghost">
          <Link to="?step=gmail">Skip</Link>
        </Button>
      </div>
    </Form>
  );
}

function Gmail({ gmail }: { gmail: GmailStatus }) {
  return (
    <div>
      <Heading title="Let your inbox do the logging">
        j*b reads job emails, matches each one to its application and moves the status along: applied, interview, offer, rejected.
      </Heading>
      <div className="mt-8 flex items-center gap-3 border border-stroke-secondary px-3 py-3">
        <Tile icon={Mail01Icon} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text-primary">Gmail</p>
          <p className="text-[12.5px] text-text-tertiary">Read-only. Emails it isn't sure about wait for you to confirm.</p>
        </div>
        {gmail.connected ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-green-primary">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.5} />
            Connected
          </span>
        ) : (
          <GmailConnectButton connected={false} broken={!!gmail.lastError} callbackURL="/welcome?step=done" className="h-9 px-3.5 text-[13.5px]" />
        )}
      </div>
      <div className="mt-8 flex items-center gap-2">
        {gmail.connected && (
          <Button asChild>
            <Link to="?step=done">Continue</Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link to="?step=details">Back</Link>
        </Button>
        {!gmail.connected && (
          <Button asChild variant="ghost">
            <Link to="?step=done">Not now</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Done({ connected }: { connected: boolean }) {
  const submitting = useNavigation().state !== "idle";
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="finish" />
      <Heading title="You're set">
        {connected
          ? "Gmail is connected, so applications show up as the sync finds them. Want a quick lesson in the meantime?"
          : "Gmail isn't connected yet. The Connect Gmail lesson shows where to do it. Pick a lesson, or go straight in."}
      </Heading>
      <div className="mt-8 flex flex-col border border-stroke-secondary">
        <p className="border-b border-stroke-secondary px-3 py-2 text-[12px] font-medium text-text-tertiary">Lessons</p>
        {LESSON_IDS.filter((id) => !(connected && id === "gmail")).map((id, i) => (
          <button
            key={id}
            type="submit"
            name="lesson"
            value={id}
            disabled={submitting}
            style={stagger(3 + i * 2)}
            className="rise flex cursor-pointer items-center gap-3 border-b border-stroke-secondary px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-ink/[0.04] disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-text-primary">{LESSONS[id].title}</span>
              <span className="block truncate text-[12.5px] text-text-tertiary">{LESSONS[id].blurb}</span>
            </span>
            <span className="shrink-0 text-[12.5px] tabular-nums text-text-tertiary">{LESSONS[id].steps.length} steps</span>
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} className="shrink-0 text-text-tertiary" />
          </button>
        ))}
      </div>
      <div className="mt-8">
        <Button type="submit" disabled={submitting}>
          Go to j*b
        </Button>
      </div>
    </Form>
  );
}
