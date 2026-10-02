import { Input } from "~/components/ui/input";
import { Section } from "~/components/ui/terminal";
import type { ProfileForm } from "~/types/profile";
import { Field, FieldGrid } from "~/components/profile/field";

export function AddressSection({
  n,
  value,
  onChange,
}: {
  n: string;
  value: ProfileForm["personal"]["address"];
  onChange: (patch: Partial<ProfileForm["personal"]["address"]>) => void;
}) {
  return (
    <Section
      n={n}
      id="address"
      title="Address"
      hint="Used for postal fields on applications."
      i={2}
    >
      <div className="flex flex-col gap-4">
        <Field label="Address line 1">
          <Input
            value={value.line1}
            onChange={(e) => onChange({ line1: e.target.value })}
          />
        </Field>
        <Field label="Address line 2 (optional)">
          <Input
            value={value.line2}
            onChange={(e) => onChange({ line2: e.target.value })}
          />
        </Field>
        <FieldGrid cols={3}>
          <Field label="City">
            <Input
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
            />
          </Field>
          <Field label="County / Region">
            <Input
              value={value.county}
              onChange={(e) => onChange({ county: e.target.value })}
            />
          </Field>
          <Field label="Postcode">
            <Input
              value={value.postcode}
              onChange={(e) => onChange({ postcode: e.target.value })}
            />
          </Field>
        </FieldGrid>
        <Field label="Country">
          <Input
            value={value.country}
            onChange={(e) => onChange({ country: e.target.value })}
          />
        </Field>
      </div>
    </Section>
  );
}
