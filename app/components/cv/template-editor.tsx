import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { DEFAULT_CV_TEMPLATE } from "~/lib/typst";
import type { TypstCv } from "~/types/cv";
import { TypstPreview } from "./typst-preview";

export function TemplateEditor({ saved, cv }: { saved: string | null; cv: TypstCv }) {
  const fetcher = useFetcher();
  const [template, setTemplate] = useState(saved ?? DEFAULT_CV_TEMPLATE);
  const changed = template !== (saved ?? DEFAULT_CV_TEMPLATE);
  const save = (value: string | null) => fetcher.submit({ intent: "template", template: value ?? "" }, { method: "post" });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col gap-3">
        <p className="font-sans text-[13px] normal-case tracking-normal text-text-secondary">
          Your CV arrives as <code className="font-mono">cv</code>: <code className="font-mono">cv.author</code> (name, phone, location, email,
          linkedin, github, website), experience, projects, education, skills (labelled groups) and certifications. Every tailored CV uses this
          template too.
        </p>
        <Textarea
          rows={32}
          spellCheck={false}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="font-mono text-[12px] leading-relaxed"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="small" className="uppercase" disabled={!changed || fetcher.state !== "idle"} onClick={() => save(template)}>
            {fetcher.state !== "idle" ? "Saving…" : "Save template"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="small"
            className="uppercase"
            onClick={() => {
              setTemplate(DEFAULT_CV_TEMPLATE);
              save(null);
            }}
          >
            Reset to default
          </Button>
        </div>
      </div>
      <div className="xl:sticky xl:top-16 xl:self-start">
        <TypstPreview template={template} cv={cv} />
      </div>
    </div>
  );
}
