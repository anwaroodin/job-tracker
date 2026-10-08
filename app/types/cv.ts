export interface CvBullet {
  id: string;
  text: string;
  bold?: string[];
}

export interface CvExperience {
  id: string;
  company: string;
  title: string;
  start: string;
  end: string | null;
  location: string;
  url: string;
  bullets: CvBullet[];
}

export interface CvEducation {
  id: string;
  institution: string;
  qualification: string;
  location: string;
  start: string;
  end: string | null;
  details: string[];
}

export interface CvProject {
  id: string;
  name: string;
  url: string;
  subtitle: string;
  details: string;
  bullets: CvBullet[];
  optional?: boolean;
}

export interface SkillGroup {
  id: string;
  label: string;
  items: string[];
}

export interface Cv {
  summaries: { id: string; text: string }[];
  experience: CvExperience[];
  education: CvEducation[];
  projects: CvProject[];
  skills: SkillGroup[];
  certifications: string[];
  targetRoles: string[];
}

export type CvImportResult = { cv: Cv; lines: number } | { error: string };

export interface CoverLetter {
  greeting: string;
  paragraphs: string[];
  signOff: string;
}

export interface CvContent {
  summary: string;
  summaryBold?: string[];
  experience: CvExperience[];
  education: CvEducation[];
  projects: CvProject[];
  skills: SkillGroup[];
  certifications: string[];
}

export interface TailoredCv extends CvContent {
  coverLetter: CoverLetter;
  edits?: ResumeChange[];
  rejectedEdits?: number;
  score?: { before: AtsScore; after: AtsScore };
  strategy?: string;
  changes: string[];
  flags: string[];
}

export interface TailorRequest {
  system: string;
  schema: object;
  input: string;
  model?: string;
  effort?: "low" | "medium" | "high";
  web?: boolean;
}

export interface RunnerUsage {
  costUsd: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
}

export interface PlanUsage {
  fiveHour: number | null;
  sevenDay: number | null;
}

export interface CompanyResearch {
  summary: string;
  values: string[];
  lookingFor: string[];
  culture: string[];
  news: string[];
  sources: { title: string; url: string }[];
  researchedAt: string;
}

export interface Person {
  name: string;
  phone: string;
  location: string;
  email: string;
  linkedin: string;
  github: string;
  website: string;
}

export interface TailoredCvCard {
  applicationId: string;
  company: string;
  role: string;
  version: number;
  createdAt: string;
  cv: CvContent;
}

export interface TypstCv {
  author: Person;
  summary: string;
  summaryBold: string[];
  experience: { title: string; company: string; location: string; url: string; start: string; end: string | null; bullets: string[]; bold: string[][] }[];
  projects: { name: string; url: string; subtitle: string; details: string; bullets: string[]; bold: string[][] }[];
  education: { institution: string; qualification: string; location: string; start: string; end: string | null; details: string[] }[];
  skills: { label: string; items: string[] }[];
  certifications: string[];
}

export interface JobKeywords {
  company: string;
  role: string;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirements: string[];
  educationRequirements: string[];
  keyResponsibilities: string[];
  keywords: string[];
  experienceYears: number | null;
  seniorityLevel: string;
}

export interface ResumeChange {
  path: string;
  action: "replace" | "append" | "reorder" | "add_skill";
  original: string | null;
  value: string | string[];
  reason: string;
}

export interface SkillTarget {
  skill: string;
  source: "existing" | "jd_added" | "supported_by_resume";
  reason: string;
}

export interface AtsScore {
  overall: number;
  keywordMatch: number;
  skillsCoverage: number;
  sectionCompleteness: number;
  keywords: { term: string; kind: "required" | "preferred" | "keyword"; found: boolean }[];
  missing: string[];
  injectable: string[];
  recommendations: string[];
}
