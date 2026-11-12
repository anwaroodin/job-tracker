import { PageSection } from "~/components/ui/page-section";
import { Textarea } from "~/components/ui/textarea";
import { newId } from "~/lib/cv";
import type { Cv } from "~/types/cv";
import { AddButton, EducationList, ExperienceList, ListField, ProjectList, RemoveButton, removeAt, updateAt } from "./entries";
import { CvImport } from "./import";
import { AnswerList } from "./answers";
import { SkillGroupList } from "./skills";

const MAX_SUMMARIES = 3;

export const CV_SECTIONS = [
  { id: "import", title: "Import", description: "Fill this page from a CV you already have." },
  { id: "summaries", title: "Summaries", description: "Up to three versions, plus the roles you're after." },
  { id: "experience", title: "Experience", description: "Newest first." },
  { id: "education", title: "Education" },
  { id: "projects", title: "Projects" },
  { id: "skills", title: "Skills", description: "Grouped as on your CV, plus certifications." },
  { id: "answers", title: "Answers", description: "What you told tailoring you have, or don't, beyond this CV." },
] as const;

function CvPart({ id, children }: { id: (typeof CV_SECTIONS)[number]["id"]; children: React.ReactNode }) {
  const section = CV_SECTIONS.find((s) => s.id === id)!;
  return (
    <PageSection id={section.id} title={section.title} description={"description" in section ? section.description : undefined}>
      <div className="flex flex-col gap-4">{children}</div>
    </PageSection>
  );
}

export function CvEditor({ value, onChange }: { value: Cv; onChange: (patch: Partial<Cv>) => void }) {
  return (
    <>
      <CvPart id="import">
        <CvImport onImported={(cv) => onChange({ ...cv, targetRoles: value.targetRoles, confirmed: value.confirmed })} />
      </CvPart>

      <CvPart id="summaries">
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
              placeholder="Two or three sentences on who you are and what you're after"
              className="text-[14px] leading-relaxed [field-sizing:content]"
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

      <CvPart id="experience">
        <ExperienceList value={value.experience} onChange={(experience) => onChange({ experience })} />
      </CvPart>

      <CvPart id="education">
        <EducationList value={value.education} onChange={(education) => onChange({ education })} />
      </CvPart>

      <CvPart id="projects">
        <ProjectList value={value.projects} onChange={(projects) => onChange({ projects })} />
      </CvPart>

      <CvPart id="skills">
        <SkillGroupList value={value.skills} onChange={(skills) => onChange({ skills })} />
        <ListField
          label="Certifications (one per line)"
          value={value.certifications}
          separator={"\n"}
          placeholder="AWS Certified Cloud Practitioner"
          onChange={(certifications) => onChange({ certifications })}
        />
      </CvPart>

      <CvPart id="answers">
        <AnswerList value={value.confirmed} onChange={(confirmed) => onChange({ confirmed })} />
      </CvPart>
    </>
  );
}
