import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { CvPreview, PdfButton } from "~/components/cv/cv-preview";
import { Button } from "~/components/ui/button";
import { RichText } from "~/components/ui/rich-text";
import { HighlightKey } from "~/components/application-detail/job-description";
import { cn } from "~/lib/cn";
import { pdfCv } from "~/lib/cv";
import type { AtsScore, CompanyResearch, CvDesign, Person, TailoredCv } from "~/types/cv";
import { ResearchView } from "~/components/application-detail/research";
import { CoverLetterDocument } from "./document";
import { TailoredCvEditor } from "./editor";
import { EditsView } from "./edits";
import { KeywordGroups } from "./keyword-groups";
import { BrandWord } from "~/components/shell/brand-word";

type Tab = "cv" | "changes" | "keywords" | "letter" | "job" | "company";

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center border border-stroke-secondary px-6 py-10 text-center">
      <BrandWord word="resume" size={24} className="mb-3" />
      <p className="font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[13px] text-text-tertiary">{children}</p>
    </div>
  );
}

export function TailoredTabs({
  cv,
  person,
  design,
  filename,
  score,
  description,
  research,
  company,
}: {
  cv: TailoredCv | null;
  person: Person;
  design: CvDesign;
  filename: string;
  score: { before: AtsScore; after?: AtsScore } | null;
  description?: string | null;
  research?: CompanyResearch | null;
  company?: string;
}) {
  const [tab, setTab] = useState<Tab>("cv");
  const [editing, setEditing] = useState(false);
  const changes = cv ? (cv.edits?.length ?? 0) + cv.flags.length + cv.changes.length : 0;
  const letter = cv && cv.coverLetter.paragraphs.length > 0;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "cv", label: "CV" },
    ...(changes ? [{ id: "changes" as const, label: "What changed", count: cv?.edits?.length || undefined }] : []),
    ...(score ? [{ id: "keywords" as const, label: "Keywords" }] : []),
    ...(letter ? [{ id: "letter" as const, label: "Cover letter" }] : []),
    ...(description ? [{ id: "job" as const, label: "Job description" }] : []),
    ...(research ? [{ id: "company" as const, label: company ? `About ${company}` : "Company" }] : []),
  ];
  const shown = tabs.some((t) => t.id === tab) ? tab : "cv";

  return (
    <section className="flex flex-col gap-4">
      <div role="tablist" aria-label="Tailored documents" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-stroke-secondary pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={shown === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3 text-[13px] font-medium transition-colors",
              shown === t.id ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular-nums text-text-tertiary">{t.count}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {shown === "cv" &&
          (!cv ? (
            <Empty title="No tailored CV yet">Tailor it above. It takes a few minutes, and you can browse other pages while it works.</Empty>
          ) : editing ? (
            <TailoredCvEditor value={cv} onDone={() => setEditing(false)} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" size="small" onClick={() => setEditing(true)}>
                  <HugeiconsIcon icon={PencilEdit02Icon} size={16} strokeWidth={1.5} />
                  Edit
                </Button>
                <PdfButton cv={pdfCv(person, cv, design)} filename={filename} />
              </div>
              <CvPreview cv={pdfCv(person, cv, design)} filename={filename} />
            </div>
          ))}
        {shown === "changes" && cv && <EditsView cv={cv} keywords={score?.before.keywords.map((k) => k.term) ?? []} />}
        {shown === "keywords" && score && <KeywordGroups before={score.before} after={score.after} />}
        {shown === "letter" && cv && <CoverLetterDocument person={person} letter={cv.coverLetter} />}
        {shown === "job" && description && (
          <div className="max-w-3xl">
            {score && <HighlightKey />}
            <RichText text={description} className="text-[14px]" highlights={score?.before.keywords ?? []} />
          </div>
        )}
        {shown === "company" && research && <ResearchView research={research} />}
      </div>
    </section>
  );
}
