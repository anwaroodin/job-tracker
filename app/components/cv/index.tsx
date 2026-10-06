import { Section } from "~/components/ui/terminal";
import { Textarea } from "~/components/ui/textarea";
import { newId } from "~/lib/cv";
import type { Cv } from "~/types/cv";
import { AddButton, EducationList, ExperienceList, ListField, ProjectList, RemoveButton, removeAt, updateAt } from "./entries";
import { CvImport } from "./import";
import { SkillGroupList } from "./skills";

const MAX_SUMMARIES = 3;

export const CV_SECTIONS = [
  { n: "02", id: "import", title: "Import", hint: "Fill this page from a CV you already have." },
  { n: "03", id: "summaries", title: "Summaries", hint: "Up to three versions, plus the roles you're after." },
  { n: "04", id: "experience", title: "Experience", hint: "Newest first." },
  { n: "05", id: "education", title: "Education" },
  { n: "06", id: "projects", title: "Projects" },
  { n: "07", id: "skills", title: "Skills", hint: "Grouped as on your CV, plus certifications." },
] as const;

function CvPart({ id, i, children }: { id: (typeof CV_SECTIONS)[number]["id"]; i: number; children: React.ReactNode }) {
  const section = CV_SECTIONS.find((s) => s.id === id)!;
  return (
    <Section n={section.n} id={section.id} title={section.title} hint={"hint" in section ? section.hint : undefined} i={i}>
      <div className="flex flex-col gap-4">{children}</div>
    </Section>
  );
}

export function CvEditor({ value, onChange }: { value: Cv; onChange: (patch: Partial<Cv>) => void }) {
  return (
    <>
      <CvPart id="import" i={1}>
        <CvImport onImported={(cv) => onChange({ ...cv, targetRoles: value.targetRoles })} />
      </CvPart>

      <CvPart id="summaries" i={2}>
        <ListField
          label="Roles you're targeting (comma-separated)"
          value={value.targetRoles}
          separator=","
          placeholder="Frontend engineer, Full-stack developer"
          onChange={(targetRoles) => onChange({ targetRoles })}
        />
        {value.summaries.map((s, j) => (
          <div key={s.id} className="flex items-start gap-2">
            <Textarea
              rows={3}
              value={s.text}
              onChange={(e) => onChange({ summaries: updateAt(value.summaries, j, { text: e.target.value }) })}
            />
            <RemoveButton label="Remove summary" onClick={() => onChange({ summaries: removeAt(value.summaries, j) })} />
          </div>
        ))}
        {value.summaries.length < MAX_SUMMARIES && (
          <AddButton label="Summary" onClick={() => onChange({ summaries: [...value.summaries, { id: newId(), text: "" }] })} />
        )}
      </CvPart>

      <CvPart id="experience" i={3}>
        <ExperienceList value={value.experience} onChange={(experience) => onChange({ experience })} />
      </CvPart>

      <CvPart id="education" i={4}>
        <EducationList value={value.education} onChange={(education) => onChange({ education })} />
      </CvPart>

      <CvPart id="projects" i={5}>
        <ProjectList value={value.projects} onChange={(projects) => onChange({ projects })} />
      </CvPart>

      <CvPart id="skills" i={6}>
        <SkillGroupList value={value.skills} onChange={(skills) => onChange({ skills })} />
        <ListField
          label="Certifications (one per line)"
          value={value.certifications}
          separator={"\n"}
          placeholder="AWS Certified Cloud Practitioner"
          onChange={(certifications) => onChange({ certifications })}
        />
      </CvPart>
    </>
  );
}
