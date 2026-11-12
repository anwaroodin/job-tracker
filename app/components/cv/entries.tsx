import { Add01Icon, ArrowDown01Icon, Cancel01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CompanyLogo } from "~/components/applications/company-logo";
import { cn } from "~/lib/cn";
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

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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


export function AddButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="small"
      className={cn("h-9 w-full justify-center px-2.5 font-sans text-[13.5px] normal-case tracking-normal text-text-secondary border border-dashed border-stroke-secondary hover:border-stroke-primary hover:bg-ink/[0.02]", className)}
      onClick={onClick}
    >
      <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.5} />
      Add {label.toLowerCase()}
    </Button>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} className="shrink-0 text-text-tertiary hover:text-red-primary">
      <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
    </Button>
  );
}

export function Entry({
  heading,
  sub,
  logo,
  onRemove,
  children,
}: {
  heading: string;
  sub?: string;
  logo?: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!logo && !sub);
  return (
    <div className={cn("border-b border-stroke-secondary last:border-b-0", open && "bg-ink/[0.02]")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          {logo && <CompanyLogo company={logo} className="size-9 text-[14px]" />}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-text-primary">{heading}</span>
            {sub && <span className="block truncate text-[12.5px] text-text-tertiary">{sub}</span>}
          </span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={1.5}
            className={cn("shrink-0 text-text-tertiary transition-transform", open && "rotate-180")}
          />
        </button>
        <RemoveButton label={`Remove ${heading}`} onClick={onRemove} />
      </div>
      {open && <div className={cn("flex flex-col gap-5 px-3 pb-5 pt-1", logo && "sm:pl-15")}>{children}</div>}
    </div>
  );
}

export function EntryList({ children }: { children: React.ReactNode }) {
  return <div className="border border-stroke-secondary">{children}</div>;
}

const span = (start: string, end: string | null) => (start ? `${start} – ${end || "Present"}` : "");

export function Bullets({ value, onChange }: { value: CvBullet[]; onChange: (bullets: CvBullet[]) => void }) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, i: number) => {
    setDraggingIdx(i);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(i));
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIdx !== i) setOverIdx(i);
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggingIdx !== null && draggingIdx !== targetIdx) {
      onChange(moveItem(value, draggingIdx, targetIdx));
    }
    setDraggingIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] text-text-tertiary">What you did</span>
      {value.map((bullet, i) => (
        <div
          key={bullet.id}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDrop={(e) => handleDrop(e, i)}
          onDragEnd={handleDragEnd}
          className={cn(
            "flex items-start gap-1 transition-opacity",
            draggingIdx === i && "opacity-40",
            overIdx === i && draggingIdx !== i && "border-t-2 border-accent-primary",
          )}
        >
          <span
            aria-label="Drag to reorder point"
            title="Drag to reorder"
            className="mt-2 flex shrink-0 cursor-grab active:cursor-grabbing p-1 text-text-tertiary hover:text-text-primary"
          >
            <HugeiconsIcon icon={DragDropVerticalIcon} size={14} strokeWidth={1.5} />
          </span>
          <Textarea
            rows={1}
            value={bullet.text}
            placeholder="Led…, built…, cut… by 40%"
            onChange={(e) => onChange(updateAt(value, i, { text: e.target.value }))}
            className="min-h-9 resize-none py-2 text-[14px] leading-relaxed [field-sizing:content]"
          />
          <RemoveButton label="Remove bullet" onClick={() => onChange(removeAt(value, i))} />
        </div>
      ))}
      <AddButton label="Point" onClick={() => onChange([...value, { id: newId(), text: "" }])} />
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
      {value.length > 0 && <EntryList>
      {value.map((job, i) => (
        <Entry
          key={job.id}
          heading={job.title || "New role"}
          sub={[job.company, span(job.start, job.end)].filter(Boolean).join(" · ")}
          logo={job.company || undefined}
          onRemove={() => onChange(removeAt(value, i))}
        >
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
      </EntryList>}
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
      {value.length > 0 && <EntryList>
      {value.map((school, i) => (
        <Entry
          key={school.id}
          heading={school.qualification || "New entry"}
          sub={[school.institution, span(school.start, school.end)].filter(Boolean).join(" · ")}
          logo={school.institution || undefined}
          onRemove={() => onChange(removeAt(value, i))}
        >
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
      </EntryList>}
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
      {value.length > 0 && <EntryList>
      {value.map((project, i) => (
        <Entry
          key={project.id}
          heading={project.name || "New project"}
          sub={[project.optional ? "In reserve" : "", project.details].filter(Boolean).join(" · ")}
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
            <span className="text-[13px] text-text-tertiary">
              Off keeps it in reserve: tailoring adds it when it suits the job.
            </span>
          </div>
        </Entry>
      ))}
      </EntryList>}
      <AddButton label="Project" onClick={() => onChange([...value, { id: newId(), name: "", url: "", subtitle: "", details: "", bullets: [] }])} />
    </div>
  );
}
