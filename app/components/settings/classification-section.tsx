import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Section } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { CONFIDENCE_LEVELS, type Classifier, type Settings } from "~/lib/settings";
import { Setting } from "~/components/settings/setting-row";
import { Segmented } from "~/components/settings/segmented";

export function ClassificationSection({
  form,
  update,
  jevAvailable,
  budgetText,
  setBudgetText,
  budgetInvalid,
}: {
  form: Settings;
  update: (patch: Partial<Settings>) => void;
  jevAvailable: boolean;
  budgetText: string;
  setBudgetText: (text: string) => void;
  budgetInvalid: boolean;
}) {
  return (
    <Section n="02" id="classification" title="Email classification" hint="how emails get a stage" i={1}>
      <div className="flex flex-col gap-7">
        <Setting
          label="Classifier"
          description={
            jevAvailable
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
            value={jevAvailable ? form.classifier : "regex"}
            disabled={!jevAvailable}
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
  );
}
