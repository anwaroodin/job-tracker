import { AUTOMATED_SENDER } from "./email-pattern";

export interface Sender {
  name: string;
  email: string;
}

interface TimelineSender {
  fromName: string | null;
  fromAddress: string | null;
  dismissedAt: string | null;
}

export function peopleWhoEmailed(emails: TimelineSender[], ownAddress: string): Sender[] {
  const own = ownAddress.toLowerCase();
  const people = new Map<string, Sender>();
  for (const { fromName, fromAddress, dismissedAt } of emails) {
    const email = fromAddress?.trim().toLowerCase() ?? "";
    if (dismissedAt || !email || email === own || AUTOMATED_SENDER.test(email)) continue;
    people.set(email, { name: fromName?.trim() || email, email });
  }
  return [...people.values()];
}

export function senderAddresses(emails: TimelineSender[]) {
  return emails.flatMap((email) => (!email.dismissedAt && email.fromAddress ? [email.fromAddress] : []));
}

export function outreachDraft(job: { company: string; role: string }, recipientName: string, senderName: string) {
  const firstName = recipientName.includes("@") ? "" : recipientName.split(/\s+/)[0];
  return {
    subject: `${job.role} at ${job.company}`,
    body: [
      firstName ? `Hi ${firstName},` : "Hi,",
      "",
      `I recently applied for the ${job.role} role at ${job.company} and wanted to introduce myself. I'd love to hear more about the team and what you're looking for, and I'm happy to share anything that would help.`,
      "",
      "Thanks for your time,",
      senderName,
    ].join("\n"),
  };
}

export const RECRUITER_TITLES = ["Recruiter", "Technical Recruiter", "Talent Acquisition", "Talent Partner", "Recruitment Manager"];

const TEAM_LEADS: [RegExp, string[]][] = [
  [/design|\bux\b|\bui\b/i, ["Design Manager", "Head of Design", "Design Director"]],
  [/engineer|developer|software|devops|\bsre\b|stack|backend|frontend|mobile/i, ["Engineering Manager", "Head of Engineering", "VP Engineering", "CTO"]],
  [/product/i, ["Head of Product", "Director of Product", "Group Product Manager"]],
  [/data|analyst|machine learning|\bml\b|\bai\b/i, ["Data Science Manager", "Head of Data", "Analytics Manager"]],
  [/market/i, ["Marketing Manager", "Head of Marketing"]],
  [/sales|account executive|business development/i, ["Sales Manager", "Head of Sales"]],
  [/financ|accountant/i, ["Finance Manager", "Head of Finance"]],
  [/operations|\bops\b/i, ["Operations Manager", "Head of Operations"]],
];

export const hiringManagerTitles = (role: string) => TEAM_LEADS.find(([match]) => match.test(role))?.[1] ?? ["Hiring Manager", "Team Lead"];

const RECRUITER_ROLE = /recruit|talent|sourc(er|ing)|people partner|\bhr\b|human resources/i;

export const isRecruiterRole = (role: string) => RECRUITER_ROLE.test(role);

export const linkedInCompanySlug = (company: string) =>
  company
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const linkedInCompanyPeople = (company: string, keywords: string) =>
  `https://www.linkedin.com/company/${linkedInCompanySlug(company)}/people/?${new URLSearchParams({ keywords })}`;

export const linkedInPeopleSearch = (name: string, company: string) =>
  `https://www.linkedin.com/search/results/people/?${new URLSearchParams({ keywords: `${name} ${company}` })}`;
