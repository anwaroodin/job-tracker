import type { SuggestionCandidates } from "../email/suggestions.server";
import { askJev, type ChoiceAnswer, type ChoiceQuestion, type NoulAnswer, type NoulQuestion } from "./client.server";
import type { StageUsage } from "./email-stage.server";

const EMAILS_PER_REQUEST = 5;
const MAX_TEXT_CHARS = 1500;
const MIN_PICK_PROBABILITY = 0.4;

const UNCHECKED_GUESS = 0.5;

export interface SuggestionInput extends SuggestionCandidates {
  id: string;
  from: string;
  subject: string;
  text: string;
}

export interface SuggestionResult {
  isApplication: number;
  company: string | null;
  role: string | null;
  confidence: number;
}

interface Pick {
  value: string | null;
  probability: number;
}

type Answer = ChoiceAnswer<string> | NoulAnswer;

export async function suggestApplicationsWithJev(apiKey: string, emails: SuggestionInput[]) {
  const results = new Map<string, SuggestionResult>();
  const usage: StageUsage[] = [];
  for (let start = 0; start < emails.length; start += EMAILS_PER_REQUEST) {
    const batch = emails.slice(start, start + EMAILS_PER_REQUEST);
    try {
      const state = { emails: batch.map(({ from, subject, text }) => ({ from, subject, text: text.slice(0, MAX_TEXT_CHARS) })) };
      const { model, answers, inputTokens } = await askJev<Answer>(apiKey, state, questionsFor(batch));
      batch.forEach((email, i) => results.set(email.id, readAnswers(email, i, answers)));
      usage.push({ source: "suggestions", emails: batch.length, inputTokens, model });
    } catch (error) {
      console.error("jev application suggestions failed", error);
    }
  }
  return { results, usage };
}

export function suggestWithoutJev(email: SuggestionInput): SuggestionResult {
  const company = known(email.knownCompany) ?? { value: email.companies[0] ?? null, probability: UNCHECKED_GUESS };
  const role = known(email.knownRole) ?? { value: email.roles[0] ?? null, probability: UNCHECKED_GUESS };
  return combine(1, company, role);
}

function questionsFor(batch: SuggestionInput[]) {
  return Object.fromEntries(
    batch.flatMap((email, i) => {
      const questions: [string, ChoiceQuestion<string> | NoulQuestion][] = [[`applied_${i}`, appliedQuestion(i)]];
      if (!email.knownCompany && email.companies.length) {
        questions.push([`company_${i}`, companyQuestion(i, email.companies)]);
      }
      if (!email.knownRole && email.roles.length) questions.push([`role_${i}`, roleQuestion(i, email.roles)]);
      return questions;
    }),
  );
}

function appliedQuestion(i: number): NoulQuestion {
  return {
    type: "noul",
    instructions: `Does \`emails[${i}]\` show that the job seeker submitted an application for a specific job?`,
    criteria: {
      true: "It confirms, acknowledges or follows up on an application the job seeker sent, even if it is a rejection.",
      false: "It is a job alert, recommendation, newsletter, marketing, or an invitation to apply that they have not acted on.",
    },
  };
}

function companyQuestion(i: number, companies: string[]): ChoiceQuestion<string> {
  return {
    type: "choice",
    instructions:
      `Which of these is the employer the job seeker applied to in \`emails[${i}]\`? ` +
      "Not a job board or hiring platform such as Indeed, LinkedIn, CV-Library, Workday or Greenhouse.",
    criteria: {
      ...Object.fromEntries(companies.map((company, c) => [`company_${c}`, company])),
      none: "None of these names the employer.",
    },
  };
}

function roleQuestion(i: number, roles: string[]): ChoiceQuestion<string> {
  return {
    type: "choice",
    instructions: `Which of these is the job title the job seeker applied for in \`emails[${i}]\`?`,
    criteria: {
      ...Object.fromEntries(roles.map((role, r) => [`role_${r}`, role])),
      none: "None of these is a job title, or it is cut off or mixed with other words.",
    },
  };
}

function readAnswers(email: SuggestionInput, i: number, answers: Record<string, Answer>): SuggestionResult {
  const applied = answers[`applied_${i}`];
  return combine(
    applied?.type === "noul" ? applied.noul : 0,
    known(email.knownCompany) ?? pick(answers[`company_${i}`], "company_", email.companies),
    known(email.knownRole) ?? pick(answers[`role_${i}`], "role_", email.roles),
  );
}

function combine(isApplication: number, company: Pick, role: Pick): SuggestionResult {
  const confidence = company.value && role.value ? Math.min(isApplication, company.probability, role.probability) : 0;
  return { isApplication, company: company.value, role: role.value, confidence };
}

function known(value: string | null): Pick | null {
  return value ? { value, probability: 1 } : null;
}

function pick(answer: Answer | undefined, prefix: string, candidates: string[]): Pick {
  if (answer?.type !== "choice" || !answer.choice.startsWith(prefix)) return { value: null, probability: 0 };
  const probability = answer.probabilities[answer.choice] ?? 0;
  if (probability < MIN_PICK_PROBABILITY) return { value: null, probability: 0 };
  return { value: candidates[Number(answer.choice.slice(prefix.length))] ?? null, probability };
}
