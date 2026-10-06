import { useState } from "react";
import { useFetcher } from "react-router";
import { AddButton, Bullets, ListField, RemoveButton, removeAt } from "~/components/cv/entries";
import { Field } from "~/components/profile/field";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { CoverLetter, TailoredCv } from "~/types/cv";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border border-stroke-secondary bg-bg-grouped-primary p-4">
      <span className="text-[11px] tracking-[0.12em] text-text-secondary">{title}</span>
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
      <Field label="Summary">
        <Textarea rows={4} value={cv.summary} onChange={(e) => set({ summary: e.target.value })} />
      </Field>

      {cv.experience.map((role, i) => (
        <Group key={role.id} title={[role.title, role.company].filter(Boolean).join(" · ")}>
          <Bullets
            value={role.bullets}
            onChange={(bullets) => set({ experience: cv.experience.map((r, j) => (j === i ? { ...r, bullets } : r)) })}
          />
        </Group>
      ))}

      {cv.projects.map((project, i) => (
        <Group key={project.id} title={project.name}>
          <Bullets
            value={project.bullets}
            onChange={(bullets) => set({ projects: cv.projects.map((p, j) => (j === i ? { ...p, bullets } : p)) })}
          />
        </Group>
      ))}

      {cv.skills.map((group, i) => (
        <ListField
          key={group.id}
          label={`${group.label || "Skills"} (comma-separated)`}
          value={group.items}
          separator=","
          placeholder=""
          onChange={(items) => set({ skills: cv.skills.map((g, j) => (j === i ? { ...g, items } : g)) })}
        />
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
