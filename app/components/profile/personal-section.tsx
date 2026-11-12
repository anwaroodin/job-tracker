import { Input } from "~/components/ui/input";
import { PageSection } from "~/components/ui/page-section";
import type { ProfileForm } from "~/types/profile";
import { Field, FieldGrid } from "~/components/profile/field";

export function PersonalSection({
  value,
  onChange,
}: {
  value: ProfileForm["personal"];
  onChange: (patch: Partial<ProfileForm["personal"]>) => void;
}) {
  return (
    <PageSection
      id="personal"
      title="Personal information"
      description="Your name and how employers reach you."
    >
      <FieldGrid cols={2}>
        <Field label="First name">
          <Input
            value={value.firstName}
            onChange={(e) =>
              onChange({ firstName: e.target.value })
            }
          />
        </Field>
        <Field label="Last name">
          <Input
            value={value.lastName}
            onChange={(e) =>
              onChange({ lastName: e.target.value })
            }
          />
        </Field>
        <Field label="Email address">
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
        <Field label="Phone number">
          <Input
            type="tel"
            value={value.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </Field>
      </FieldGrid>
    </PageSection>
  );
}
