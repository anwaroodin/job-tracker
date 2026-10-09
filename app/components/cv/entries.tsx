import { X } from "lucide-react";
import { useState } from "react";
import { Field, FieldGrid } from "~/components/profile/field";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { newId } from "~/lib/cv";
import type { CvBullet, CvEducation, CvExperience, CvProject } from "~/types/cv";

export function updateAt<T>(items: T[], i: number, patch: Partial<T>) {
  return items.map((item, j) => (j === i ? { ...item, ...patch } : item));
}

export function removeAt<T>(items: T[], i: number) {
  return items.filter((_, j) => j !== i);
}

export function ListField({
  label,
  value,
  separator,
  placeholder,
  onChange,
}: {
  label: string;
  value: string[];
  separator: "," | "\n";
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const props = {
    value: draft ?? value.join(separator === "," ? ", " : "\n"),
    placeholder,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => {
      if (draft === null) return;
      onChange([...new Set(draft.split(separator).map((s) => s.trim()).filter(Boolean))]);
      setDraft(null);
    },
  };
  return <Field label={label}>{separator === "," ? <Input {...props} /> : <Textarea rows={3} {...props} />}</Field>;
}


export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="tiny" className="self-start uppercase" onClick={onClick}>
      + {label}
    </Button>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick}>
      <X />
    </Button>
  );
}

function Entry({ heading, onRemove, children }: { heading: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border border-stroke-secondary bg-bg-grouped-primary p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[11px] tracking-[0.12em] text-text-secondary">{heading}</span>
        <RemoveButton label={`Remove ${heading}`} onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

export function Bullets({ value, onChange }: { value: CvBullet[]; onChange: (bullets: CvBullet[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow !text-[10px]">Bullets</span>
      {value.map((bullet, i) => (
        <div key={bullet.id} className="flex items-start gap-2">
          <Textarea
            rows={2}
            value={bullet.text}
            onChange={(e) => onChange(updateAt(value, i, { text: e.target.value }))}
          />
          <RemoveButton label="Remove bullet" onClick={() => onChange(removeAt(value, i))} />
        </div>
      ))}
      <AddButton label="Bullet" onClick={() => onChange([...value, { id: newId(), text: "" }])} />
    </div>
  );
}

function Dates({ start, end, onChange }: { start: string; end: string | null; onChange: (p: { start?: string; end?: string | null }) => void }) {
  return (
    <>
      <Field label="Start">
        <Input value={start} placeholder="Jan 2022" onChange={(e) => onChange({ start: e.target.value })} />
      </Field>
      <Field label="End">
        <Input value={end ?? ""} placeholder="Present" onChange={(e) => onChange({ end: e.target.value || null })} />
      </Field>
    </>
  );
}

export function ExperienceList({ value, onChange }: { value: CvExperience[]; onChange: (v: CvExperience[]) => void }) {
  const set = (i: number, patch: Partial<CvExperience>) => onChange(updateAt(value, i, patch));
  return (
    <div className="flex flex-col gap-3">
      {value.map((job, i) => (
        <Entry key={job.id} heading={[job.title, job.company].filter(Boolean).join(" · ") || "New role"} onRemove={() => onChange(removeAt(value, i))}>
          <FieldGrid cols={2}>
            <Field label="Job title">
              <Input value={job.title} onChange={(e) => set(i, { title: e.target.value })} />
            </Field>
            <Field label="Company">
              <Input value={job.company} onChange={(e) => set(i, { company: e.target.value })} />
            </Field>
            <Dates start={job.start} end={job.end} onChange={(p) => set(i, p)} />
            <Field label="Location">
              <Input value={job.location} onChange={(e) => set(i, { location: e.target.value })} />
            </Field>
            <Field label="Company website">
              <Input value={job.url} placeholder="acme.co.uk" onChange={(e) => set(i, { url: e.target.value })} />
            </Field>
          </FieldGrid>
          <Bullets value={job.bullets} onChange={(bullets) => set(i, { bullets })} />
        </Entry>
      ))}
      <AddButton
        label="Role"
        onClick={() => onChange([...value, { id: newId(), title: "", company: "", start: "", end: null, location: "", url: "", bullets: [] }])}
      />
    </div>
  );
}

export function EducationList({ value, onChange }: { value: CvEducation[]; onChange: (v: CvEducation[]) => void }) {
  const set = (i: number, patch: Partial<CvEducation>) => onChange(updateAt(value, i, patch));
  return (
    <div className="flex flex-col gap-3">
      {value.map((school, i) => (
        <Entry key={school.id} heading={[school.qualification, school.institution].filter(Boolean).join(" · ") || "New entry"} onRemove={() => onChange(removeAt(value, i))}>
          <FieldGrid cols={2}>
            <Field label="Qualification">
              <Input value={school.qualification} onChange={(e) => set(i, { qualification: e.target.value })} />
            </Field>
            <Field label="Institution">
              <Input value={school.institution} onChange={(e) => set(i, { institution: e.target.value })} />
            </Field>
            <Dates start={school.start} end={school.end} onChange={(p) => set(i, p)} />
            <Field label="Location">
              <Input value={school.location} onChange={(e) => set(i, { location: e.target.value })} />
            </Field>
          </FieldGrid>
          <ListField
            label="Details (one per line)"
            value={school.details}
            separator={"\n"}
            placeholder="First-class honours, dissertation on…"
            onChange={(details) => set(i, { details })}
          />
        </Entry>
      ))}
      <AddButton
        label="Education"
        onClick={() => onChange([...value, { id: newId(), institution: "", qualification: "", location: "", start: "", end: null, details: [] }])}
      />
    </div>
  );
}

export function ProjectList({ value, onChange }: { value: CvProject[]; onChange: (v: CvProject[]) => void }) {
  const set = (i: number, patch: Partial<CvProject>) => onChange(updateAt(value, i, patch));
  return (
    <div className="flex flex-col gap-3">
      {value.map((project, i) => (
        <Entry
          key={project.id}
          heading={`${project.name || "New project"}${project.optional ? " · reserve" : ""}`}
          onRemove={() => onChange(removeAt(value, i))}
        >
          <FieldGrid cols={2}>
            <Field label="Name">
              <Input value={project.name} onChange={(e) => set(i, { name: e.target.value })} />
            </Field>
            <Field label="Link">
              <Input value={project.url} placeholder="myproject.com" onChange={(e) => set(i, { url: e.target.value })} />
            </Field>
            <Field label="Subtitle (shown when there's no link)">
              <Input value={project.subtitle} onChange={(e) => set(i, { subtitle: e.target.value })} />
            </Field>
            <Field label="Tech stack">
              <Input value={project.details} placeholder="TypeScript, Next.js, PostgreSQL" onChange={(e) => set(i, { details: e.target.value })} />
            </Field>
          </FieldGrid>
          <Bullets value={project.bullets} onChange={(bullets) => set(i, { bullets })} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Switch checked={!project.optional} onCheckedChange={(shown) => set(i, { optional: shown ? undefined : true })} label="Show on CV" />
            <span className="font-sans text-[12.5px] normal-case tracking-normal text-text-tertiary">
              Off keeps it in reserve: tailoring adds it when it suits the job.
            </span>
          </div>
        </Entry>
      ))}
      <AddButton label="Project" onClick={() => onChange([...value, { id: newId(), name: "", url: "", subtitle: "", details: "", bullets: [] }])} />
    </div>
  );
}
