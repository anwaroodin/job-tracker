import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Section } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { Field, FieldGrid } from "~/components/profile/field";

export function CvCard({
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
