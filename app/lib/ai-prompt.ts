import type { Confirmation, CvContent } from "~/types/cv";
import type { ProfileForm } from "~/types/profile";
import { shownProjects } from "./cv";

export interface PromptJob {
  company: string;
  role: string;
  location: string;
  salary: string;
  workType: string;
  employmentType: string;
  url: string;
  description: string;
}

interface PromptInput {
  job: PromptJob;
  cv: CvContent;
  tailored: boolean;
  confirmed: Confirmation[];
  name: string;
  eligibility: ProfileForm["eligibility"];
}

const dates = (start: string, end: string | null) => [start, end ?? "Present"].filter(Boolean).join(" – ");
const section = (title: string, lines: string[]) => (lines.length ? [`## ${title}`, ...lines, ""] : []);
const bullets = (items: { text: string }[]) => items.map((b) => `- ${b.text}`);

function cvText(cv: CvContent) {
  return [
    ...section("Summary", cv.summary ? [cv.summary] : []),
    ...section(
      "Experience",
      cv.experience.flatMap((e) => [`### ${e.title}, ${e.company}${e.location ? ` (${e.location})` : ""} · ${dates(e.start, e.end)}`, ...bullets(e.bullets)]),
    ),
    ...section(
      "Projects",
      shownProjects(cv).flatMap((p) => [`### ${p.name}${p.details ? ` (${p.details})` : ""}`, ...bullets(p.bullets)]),
    ),
    ...section(
      "Education",
      cv.education.flatMap((e) => [`### ${e.qualification}, ${e.institution} · ${dates(e.start, e.end)}`, ...e.details.map((d) => `- ${d}`)]),
    ),
    ...section("Skills", cv.skills.filter((g) => g.items.length).map((g) => `- ${g.label}: ${g.items.join(", ")}`)),
    ...section("Certifications", cv.certifications.map((c) => `- ${c}`)),
  ];
}

export function aiPrompt({ job, cv, tailored, confirmed, name, eligibility }: PromptInput) {
  const facts = [
    job.location && `Location: ${job.location}`,
    job.workType && `Work type: ${job.workType}`,
    job.employmentType && `Employment: ${job.employmentType}`,
    job.salary && `Salary: ${job.salary}`,
    job.url && `Link: ${job.url}`,
  ].filter(Boolean) as string[];
  const about = [
    name && `Name: ${name}`,
    `Right to work where the job is: ${eligibility.rightToWork ? "yes" : "no"}`,
    `Needs visa sponsorship: ${eligibility.requiresSponsorship ? "yes" : "no"}`,
    eligibility.availableImmediately ? "Available: immediately" : eligibility.noticePeriod && `Notice period: ${eligibility.noticePeriod}`,
    eligibility.salary && `Salary expectation: ${eligibility.salary}`,
  ].filter(Boolean) as string[];
  const answers = confirmed.filter((c) => c.has).map((c) => `- ${c.term}${c.detail ? `: ${c.detail}` : ""}`);

  return [
    `I'm applying for ${job.role} at ${job.company}. Below are the job description and my CV. Help me with my application, using only facts from my CV and the notes below, never inventing experience, numbers or skills. Write in British English.`,
    "",
    "What I'd like help with: ",
    "",
    `# The job: ${job.role} at ${job.company}`,
    ...facts,
    "",
    job.description.trim() || "(No description saved. Ask me to paste it.)",
    "",
    `# My CV${tailored ? " (already tailored to this job)" : ""}`,
    ...cvText(cv),
    ...section("Things I've confirmed that aren't on my CV", answers),
    ...section("About me", about),
  ]
    .join("\n")
    .trim();
}
