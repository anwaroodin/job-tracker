import { X } from "lucide-react";
import { useRef } from "react";
import { AddButton, RemoveButton, removeAt, updateAt } from "~/components/cv/entries";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { newId } from "~/lib/cv";
import { cn } from "~/lib/cn";
import type { CvBullet } from "~/types/cv";

export function BoldText({
  text,
  bold,
  rows = 2,
  onChange,
}: {
  text: string;
  bold: string[];
  rows?: number;
  onChange: (patch: { text?: string; bold?: string[] }) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const boldSelection = () => {
    const el = input.current;
    const phrase = el ? el.value.slice(el.selectionStart, el.selectionEnd).trim() : "";
    if (phrase && !bold.includes(phrase)) onChange({ bold: [...bold, phrase] });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Textarea ref={input} rows={rows} value={text} onChange={(e) => onChange({ text: e.target.value })} />
      <div className="flex flex-wrap items-center gap-2">
        {bold.map((phrase) => (
          <span
            key={phrase}
            title={text.includes(phrase) ? "Bold in the CV" : "No longer in this line, so it won't be bold"}
            className={cn(
              "inline-flex items-center gap-1 border border-stroke-secondary py-0.5 pl-2 pr-0.5 font-sans text-[12px] normal-case tracking-normal",
              text.includes(phrase) ? "font-semibold text-text-primary" : "text-text-tertiary line-through",
            )}
          >
            {phrase}
            <Button type="button" variant="ghost" size="icon-sm" className="size-5" aria-label={`Unbold ${phrase}`} onClick={() => onChange({ bold: bold.filter((p) => p !== phrase) })}>
              <X />
            </Button>
          </span>
        ))}
        <Button type="button" variant="ghost" size="tiny" className="uppercase" onMouseDown={(e) => e.preventDefault()} onClick={boldSelection}>
          Bold selection
        </Button>
      </div>
    </div>
  );
}

export function BoldBullets({ value, onChange }: { value: CvBullet[]; onChange: (bullets: CvBullet[]) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {value.map((bullet, i) => (
        <div key={bullet.id} className="flex items-start gap-2">
          <BoldText text={bullet.text} bold={bullet.bold ?? []} onChange={(patch) => onChange(updateAt(value, i, patch))} />
          <RemoveButton label="Remove bullet" onClick={() => onChange(removeAt(value, i))} />
        </div>
      ))}
      <AddButton label="Bullet" onClick={() => onChange([...value, { id: newId(), text: "" }])} />
    </div>
  );
}
