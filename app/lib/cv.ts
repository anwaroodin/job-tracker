import type { Cv, CvBullet, CvContent, Person, TypstCv } from "~/types/cv";
import type { ProfileForm } from "~/types/profile";

export const EMPTY_CV: Cv = {
  summaries: [],
  experience: [],
  education: [],
  projects: [],
  skills: [],
  certifications: [],
  targetRoles: [],
  confirmed: [],
};

export const newId = () => crypto.randomUUID().slice(0, 8);

export const bareUrl = (url: string) => url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

export const allSkills = (cv: Pick<CvContent, "skills">) => cv.skills.flatMap((group) => group.items);

export function cvContent(cv: Cv): CvContent {
  const { summaries, experience, education, projects, skills, certifications } = cv;
  return { summary: summaries[0]?.text ?? "", experience, education, projects, skills, certifications };
}

export function personFor(personal: ProfileForm["personal"], account: { name?: string | null; email: string }): Person {
  const { firstName, lastName, email, phone, address, linkedin, github, portfolio } = personal;
  return {
    name: [firstName, lastName].filter(Boolean).join(" ") || account.name || "",
    phone,
    location: [address.city, address.country].filter(Boolean).join(", "),
    email: email || account.email,
    linkedin: bareUrl(linkedin),
    github: bareUrl(github),
    website: bareUrl(portfolio),
  };
}

export const contactLine = (person: Person) =>
  [person.phone, person.location, person.email, person.linkedin, person.github, person.website].filter(Boolean).join(" · ");

export const shownProjects = (cv: Pick<CvContent, "projects">) => cv.projects.filter((p) => !p.optional);

export function typstCv(person: Person, cv: CvContent): TypstCv {
  const texts = (bullets: CvBullet[]) => bullets.map((b) => b.text);
  const bold = (bullets: CvBullet[]) => bullets.map((b) => b.bold ?? []);
  return {
    author: person,
    summary: cv.summary,
    summaryBold: cv.summaryBold ?? [],
    experience: cv.experience.map(({ title, company, location, url, start, end, bullets }) => ({
      title,
      company,
      location,
      url: bareUrl(url),
      start,
      end,
      bullets: texts(bullets),
      bold: bold(bullets),
    })),
    projects: shownProjects(cv).map(({ name, url, subtitle, details, bullets }) => ({ name, url: bareUrl(url), subtitle, details, bullets: texts(bullets), bold: bold(bullets) })),
    education: cv.education.map(({ institution, qualification, location, start, end, details }) => ({
      institution,
      qualification,
      location,
      start,
      end,
      details,
    })),
    skills: cv.skills.map(({ label, items }) => ({ label, items })),
    certifications: cv.certifications,
  };
}
