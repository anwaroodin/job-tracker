import { AnimatePresence, motion } from "motion/react";
import { Form, Link, useNavigation } from "react-router";
import { GmailConnectButton } from "~/components/gmail/gmail-connect";
import { Field, FieldGrid } from "~/components/profile/field";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { stagger, two } from "~/components/ui/terminal";
import { TextScramble } from "~/components/ui/text-scramble";
import { cn } from "~/lib/cn";
import type { GmailStatus } from "~/types/gmail";
import type { ProfileForm } from "~/types/profile";
import logo from "~/assets/job-tracker.png";
import { LESSON_IDS, LESSONS } from "./lessons";

export const SETUP_STEPS = ["intro", "details", "gmail", "done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
const LABELS: Record<SetupStep, string> = { intro: "Welcome", details: "You", gmail: "Gmail", done: "Ready" };

interface Props {
  step: SetupStep;
  user: { name?: string | null; email: string };
  personal: ProfileForm["personal"];
  gmail: GmailStatus;
}

export function SetupScreen({ step, user, personal, gmail }: Props) {
  const at = SETUP_STEPS.indexOf(step);
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg-primary font-mono text-[12.5px] uppercase tracking-[0.04em]">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5 normal-case">
            <img src={logo} className="size-7 mix-blend-difference" alt="" />
            <span className="text-[15px] font-medium tracking-[-0.03em] text-text-primary">job-tracker</span>
          </span>
          {step !== "done" && (
            <Form method="post">
              <Button type="submit" name="intent" value="skip" variant="ghost" size="tiny">
                Skip setup
              </Button>
            </Form>
          )}
        </header>

        <ol className="mt-10 grid grid-cols-4 gap-2 text-[10.5px] tracking-[0.1em]">
          {SETUP_STEPS.map((s, i) => (
            <li key={s} className={cn("flex flex-col gap-2", i <= at ? "text-text-primary" : "text-text-tertiary")}>
              <span className="relative h-px bg-stroke-primary">
                <motion.span
                  className="absolute inset-y-0 left-0 bg-accent-primary"
                  initial={false}
                  animate={{ width: i <= at ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
              <span>
                <b className="mr-1.5 font-semibold">[{two(i + 1)}]</b>
                <span className={cn(i !== at && "max-sm:hidden")}>{LABELS[s]}</span>
              </span>
            </li>
          ))}
        </ol>

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

function Heading({ eyebrow, children }: { eyebrow: string; children: string }) {
  return (
    <>
      <p className="text-[11px] tracking-[0.12em] text-text-tertiary">{eyebrow}</p>
      <TextScramble as="h1" className="mt-5 text-[26px] font-light normal-case leading-[1.2] tracking-tight text-text-primary sm:text-[32px]">
        {children}
      </TextScramble>
    </>
  );
}

function Copy({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 font-sans text-[14px] normal-case leading-relaxed tracking-normal text-text-secondary">{children}</p>;
}

function Intro({ name }: { name: string }) {
  return (
    <div>
      <Heading eyebrow="Setup · 2 minutes">{name ? `Welcome, ${name}.` : "Welcome."}</Heading>
      <Copy>
        job-tracker keeps every application in one place and updates it from your inbox. Two quick things and you're in:
        your details, then Gmail. Both can be changed or skipped.
      </Copy>
      <ul className="mt-8 flex flex-col gap-2 text-text-secondary">
        {["Your details, used to fill in applications", "Gmail, so job emails update the tracker", "Short lessons, whenever you want them"].map((t, i) => (
          <li key={t} className="rise flex gap-3" style={stagger(4 + i * 3)}>
            <span className="text-text-accent">▸</span>
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <Button asChild size="large">
          <Link to="?step=details">Let's go</Link>
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
      <Heading eyebrow="About you">The basics.</Heading>
      <Copy>The extension uses these to fill in application forms. The rest of your profile can wait.</Copy>
      <div className="mt-8 flex flex-col gap-4">
        <FieldGrid cols={2}>
          <Field label="First name">
            <Input name="firstName" defaultValue={personal.firstName || first} autoComplete="given-name" autoFocus />
          </Field>
          <Field label="Last name">
            <Input name="lastName" defaultValue={personal.lastName || rest.join(" ")} autoComplete="family-name" />
          </Field>
          <Field label="Contact email">
            <Input name="email" type="email" defaultValue={personal.email || user.email} autoComplete="email" />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={personal.phone} autoComplete="tel" />
          </Field>
          <Field label="City">
            <Input name="city" defaultValue={personal.address.city} autoComplete="address-level2" />
          </Field>
          <Field label="Country">
            <Input name="country" defaultValue={personal.address.country} autoComplete="country-name" />
          </Field>
        </FieldGrid>
      </div>
      <div className="mt-10 flex items-center gap-3">
        <Button type="submit" name="intent" value="details" size="large" disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </Button>
        <Button asChild variant="ghost" size="large">
          <Link to="?step=gmail">Skip</Link>
        </Button>
      </div>
    </Form>
  );
}

function Gmail({ gmail }: { gmail: GmailStatus }) {
  return (
    <div>
      <Heading eyebrow="Connect Gmail">Let your inbox do the logging.</Heading>
      <Copy>
        job-tracker reads job emails, matches each one to its application and moves the status along: applied, interview,
        offer, rejected. Access is read-only, and emails it isn't sure about wait for you to confirm.
      </Copy>
      <div className="mt-8 flex items-center justify-between gap-4 border border-stroke-secondary bg-bg-secondary px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center bg-bg-primary text-[12px] font-semibold text-text-primary [box-shadow:inset_0_0_0_1px_var(--stroke-secondary)]">
            G
          </span>
          <span className="text-text-primary">Gmail · read-only</span>
        </span>
        <GmailConnectButton connected={gmail.connected} broken={!!gmail.lastError} callbackURL="/welcome?step=done" />
      </div>
      <div className="mt-10 flex items-center gap-3">
        <Button asChild variant="ghost" size="large">
          <Link to="?step=details">Back</Link>
        </Button>
        <Button asChild variant="ghost" size="large">
          <Link to="?step=done">Not now</Link>
        </Button>
      </div>
    </div>
  );
}

function Done({ connected }: { connected: boolean }) {
  const submitting = useNavigation().state !== "idle";
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="finish" />
      <Heading eyebrow="Ready">You're set.</Heading>
      <Copy>
        {connected
          ? "Gmail is connected, so applications show up as the sync finds them. Want a quick lesson in the meantime?"
          : "Gmail isn't connected yet: the Connect Gmail lesson shows where to do it. Pick a lesson, or go straight in."}
      </Copy>
      <div className="mt-8 flex flex-col">
        {LESSON_IDS.filter((id) => !(connected && id === "gmail")).map((id, i) => (
          <button
            key={id}
            type="submit"
            name="lesson"
            value={id}
            disabled={submitting}
            style={stagger(3 + i * 2)}
            className="rise group flex cursor-pointer items-baseline gap-3 border-t border-dashed border-white/15 px-1 py-3 text-left uppercase transition-colors hover:bg-text-primary hover:text-text-inverse"
          >
            <span className="text-text-tertiary group-hover:text-text-inverse/70">{two(i + 1)}</span>
            <span className="text-text-primary group-hover:text-text-inverse">{LESSONS[id].title}</span>
            <span className="ml-auto hidden font-sans text-[12px] normal-case tracking-normal text-text-tertiary group-hover:text-text-inverse/70 sm:block">
              {LESSONS[id].blurb}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-10">
        <Button type="submit" size="large" disabled={submitting}>
          Go to dashboard
        </Button>
      </div>
    </Form>
  );
}
