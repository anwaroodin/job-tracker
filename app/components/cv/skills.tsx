import { Field } from "~/components/profile/field";
import { Input } from "~/components/ui/input";
import { newId } from "~/lib/cv";
import type { SkillGroup } from "~/types/cv";
import { AddButton, ListField, RemoveButton, removeAt, updateAt } from "./entries";

export function SkillGroupList({ value, onChange }: { value: SkillGroup[]; onChange: (v: SkillGroup[]) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {value.map((group, i) => (
        <div key={group.id} className="grid grid-cols-1 items-end gap-3 md:grid-cols-[200px_minmax(0,1fr)_auto]">
          <Field label="Label">
            <Input value={group.label} placeholder="Technical Skills" onChange={(e) => onChange(updateAt(value, i, { label: e.target.value }))} />
          </Field>
          <ListField
            label="Items (comma-separated)"
            value={group.items}
            separator=","
            placeholder="TypeScript, React, SQL"
            onChange={(items) => onChange(updateAt(value, i, { items }))}
          />
          <RemoveButton label={`Remove ${group.label || "group"}`} onClick={() => onChange(removeAt(value, i))} />
        </div>
      ))}
      <AddButton label="Group" onClick={() => onChange([...value, { id: newId(), label: "", items: [] }])} />
    </div>
  );
}
