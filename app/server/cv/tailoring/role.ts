import type { JobKeywords } from "~/types/cv";

export const MAX_TITLE_CHARS = 120;

export const rolePosting = (title: string) =>
  `There is no posting, only the job title "${title}". Write down what a typical UK posting for this job title asks for, using the terms employers use, and leave "company" empty.`;

export function roleDescription(title: string, jk: JobKeywords) {
  const line = (label: string, items: string[]) => (items.length ? `${label}: ${items.join("; ")}` : "");
  return [
    `Job title: ${title}`,
    "No specific employer. These are the requirements typical of this job title.",
    line("Required skills", jk.requiredSkills),
    line("Preferred skills", jk.preferredSkills),
    line("Key responsibilities", jk.keyResponsibilities),
    line("Experience", jk.experienceRequirements),
    line("Education", jk.educationRequirements),
    line("Other keywords", jk.keywords),
    line("Soft skills", jk.softSkills),
  ]
    .filter(Boolean)
    .join("\n");
}
