import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Section } from "~/components/ui/terminal";
import type { ProfileForm } from "~/types/profile";
import { Field } from "~/components/profile/field";

export function EligibilitySection({
  n,
  value,
  onChange,
}: {
  n: string;
  value: ProfileForm["eligibility"];
  onChange: (patch: Partial<ProfileForm["eligibility"]>) => void;
}) {
  return (
    <Section
      n={n}
      id="eligibility"
      title="Work eligibility"
      hint="Right to work, sponsorship, and availability."
      i={4}
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <div className="flex flex-col gap-4 normal-case">
          <Switch
            checked={value.rightToWork}
            onCheckedChange={(v) =>
              onChange({ rightToWork: v })
            }
            label="I have the right to work in the UK"
          />
          <Switch
            checked={value.requiresSponsorship}
            onCheckedChange={(v) =>
              onChange({ requiresSponsorship: v })
            }
            label="I require visa sponsorship"
          />
          <Switch
            checked={value.availableImmediately}
            onCheckedChange={(v) =>
              onChange({ availableImmediately: v })
            }
            label="Available to start immediately"
          />
        </div>
        <Field label="Notice period">
          <Input
            value={value.noticePeriod}
            onChange={(e) =>
              onChange({ noticePeriod: e.target.value })
            }
            placeholder="e.g. 2 weeks"
          />
        </Field>
      </div>
    </Section>
  );
}
