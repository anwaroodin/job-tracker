import { Input } from "~/components/ui/input";
import { Section } from "~/components/ui/terminal";
import type { ProfileForm } from "~/types/profile";
import { Field, FieldGrid } from "~/components/profile/field";

export function LinksSection({
  n,
  value,
  onChange,
}: {
  n: string;
  value: ProfileForm["personal"];
  onChange: (patch: Partial<ProfileForm["personal"]>) => void;
}) {
  return (
    <Section
      n={n}
      id="links"
      title="Links"
      hint="Attached to auto-filled applications."
      i={3}
    >
      <FieldGrid cols={2}>
        <Field label="LinkedIn">
          <Input
            value={value.linkedin}
            onChange={(e) =>
              onChange({ linkedin: e.target.value })
            }
            placeholder="https://linkedin.com/in/…"
          />
        </Field>
        <Field label="GitHub">
          <Input
            value={value.github}
            onChange={(e) => onChange({ github: e.target.value })}
            placeholder="https://github.com/…"
          />
        </Field>
      </FieldGrid>
      <div className="mt-4">
        <Field label="Portfolio">
          <Input
            value={value.portfolio}
            onChange={(e) =>
              onChange({ portfolio: e.target.value })
            }
            placeholder="https://…"
          />
        </Field>
      </div>
    </Section>
  );
}
