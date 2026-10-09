import { useState } from "react";
import { useFetcher } from "react-router";
import { AddButton, ListField, RemoveButton, removeAt, updateAt } from "~/components/cv/entries";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { CoverLetter, TailoredCv } from "~/types/cv";
import { BoldBullets, BoldText } from "./bold-text";

function Group({ title, onRemove, children }: { title: string; onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border border-stroke-secondary bg-bg-grouped-primary p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[11px] tracking-[0.12em] text-text-secondary">{title}</span>
        {onRemove && <RemoveButton label={`Remove ${title}`} onClick={onRemove} />}
      </div>
      {children}
    </div>
  );
}

export function TailoredCvEditor({ value, onDone }: { value: TailoredCv; onDone: () => void }) {
  const fetcher = useFetcher();
  const [cv, setCv] = useState(value);
  const set = (patch: Partial<TailoredCv>) => setCv((c) => ({ ...c, ...patch }));
  const setLetter = (patch: Partial<CoverLetter>) => set({ coverLetter: { ...cv.coverLetter, ...patch } });
  const saving = fetcher.state !== "idle";

  const save = () => {
    fetcher.submit({ intent: "edit", cv: JSON.stringify(cv) }, { method: "post" });
    onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      <Group title="Summary">
        <BoldText
          text={cv.summary}
          bold={cv.summaryBold ?? []}
          rows={4}
          onChange={({ text, bold }) => set({ ...(text !== undefined && { summary: text }), ...(bold && { summaryBold: bold }) })}
        />
      </Group>

      {cv.experience.map((role, i) => (
        <Group
          key={role.id}
          title={[role.title, role.company].filter(Boolean).join(" · ")}
          onRemove={() => set({ experience: removeAt(cv.experience, i) })}
        >
          <BoldBullets value={role.bullets} onChange={(bullets) => set({ experience: updateAt(cv.experience, i, { bullets }) })} />
        </Group>
      ))}

      {cv.projects.map((project, i) => (
        <Group key={project.id} title={project.name} onRemove={() => set({ projects: removeAt(cv.projects, i) })}>
          <BoldBullets value={project.bullets} onChange={(bullets) => set({ projects: updateAt(cv.projects, i, { bullets }) })} />
        </Group>
      ))}

      {cv.education.map((school, i) => (
        <Group
          key={school.id}
          title={[school.qualification, school.institution].filter(Boolean).join(" · ")}
          onRemove={() => set({ education: removeAt(cv.education, i) })}
        >
          <ListField
            label="Details (one per line)"
            value={school.details}
            separator={"\n"}
            placeholder=""
            onChange={(details) => set({ education: updateAt(cv.education, i, { details }) })}
          />
        </Group>
      ))}

      {cv.skills.map((group, i) => (
        <Group key={group.id} title={group.label || "Skills"} onRemove={() => set({ skills: removeAt(cv.skills, i) })}>
          <ListField
            label="Comma-separated"
            value={group.items}
            separator=","
            placeholder=""
            onChange={(items) => set({ skills: updateAt(cv.skills, i, { items }) })}
          />
        </Group>
      ))}

      <Group title="Cover letter">
        <Input value={cv.coverLetter.greeting} onChange={(e) => setLetter({ greeting: e.target.value })} />
        {cv.coverLetter.paragraphs.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <Textarea
              rows={4}
              value={p}
              onChange={(e) => setLetter({ paragraphs: cv.coverLetter.paragraphs.map((q, j) => (j === i ? e.target.value : q)) })}
            />
            <RemoveButton label="Remove paragraph" onClick={() => setLetter({ paragraphs: removeAt(cv.coverLetter.paragraphs, i) })} />
          </div>
        ))}
        <AddButton label="Paragraph" onClick={() => setLetter({ paragraphs: [...cv.coverLetter.paragraphs, ""] })} />
        <Input value={cv.coverLetter.signOff} onChange={(e) => setLetter({ signOff: e.target.value })} />
      </Group>

      <div className="flex gap-2">
        <Button type="button" size="small" className="uppercase" disabled={saving} onClick={save}>
          Save as new version
        </Button>
        <Button type="button" variant="ghost" size="small" className="uppercase" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
