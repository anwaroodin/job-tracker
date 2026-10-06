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

export interface CvContent {
  summary: string;
  summaryBold?: string[];
  experience: CvExperience[];
  education: CvEducation[];
  projects: CvProject[];
  skills: SkillGroup[];
  certifications: string[];
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

