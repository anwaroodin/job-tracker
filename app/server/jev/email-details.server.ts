import { chunk } from "~/lib/array";
import type { BodyLink } from "../gmail/api.server";
import type { DateCandidate } from "../email/details.server";
import { askJev, type ChoiceAnswer, type ChoiceQuestion, type NoulAnswer, type NoulQuestion } from "./client.server";
import type { StageUsage } from "./email-stage.server";

const EMAILS_PER_REQUEST = 4;
const MAX_TEXT_CHARS = 3000;
const MIN_PICK_PROBABILITY = 0.5;

export interface DetailsInput {
  id: string;
  category: string;
  from: string;
  subject: string;
  text: string;
  dates: DateCandidate[];
  links: BodyLink[];
}

export interface DetailsResult {
  eventAt: string | null;
  eventText: string | null;
  actionUrl: string | null;
  actionText: string | null;
  needsReply: number;
}

type Answer = ChoiceAnswer<string> | NoulAnswer;

export async function extractDetailsWithJev(apiKey: string, emails: DetailsInput[]) {
  const results = new Map<string, DetailsResult>();
  const usage: StageUsage[] = [];
  for (const batch of chunk(emails, EMAILS_PER_REQUEST)) {
    try {
      const { model, answers, inputTokens } = await askJev<Answer>(apiKey, stateFor(batch), questionsFor(batch));
      batch.forEach((email, i) => results.set(email.id, readAnswers(email, i, answers)));
      usage.push({ source: "details", emails: batch.length, inputTokens, model });
    } catch (error) {
      console.error("jev details failed", error);
    }
  }
  return { results, usage };
}

function stateFor(batch: DetailsInput[]) {
  return {
    emails: batch.map(({ from, subject, category, text, links }) => ({
      from,
      subject,
      stage: category,
      text: text.slice(0, MAX_TEXT_CHARS),
      links: links.map((link) => ({ text: link.text || "(no link text)", url: link.url })),
    })),
  };
}

function questionsFor(batch: DetailsInput[]) {
  return Object.fromEntries(
    batch.flatMap((email, i) => {
      const questions: [string, ChoiceQuestion<string> | NoulQuestion][] = [[`reply_${i}`, replyQuestion(i)]];
      if (email.dates.length) questions.push([`date_${i}`, dateQuestion(i, email.dates)]);
      if (email.links.length) questions.push([`link_${i}`, linkQuestion(i, email.links)]);
      return questions;
    }),
  );
}

function replyQuestion(i: number): NoulQuestion {
  return {
    type: "noul",
    instructions:
      `Is the sender of \`emails[${i}]\` waiting for the job seeker to reply, for example to share availability, ` +
      "confirm attendance, answer a question or send documents?",
    criteria: {
      true: "The email asks the job seeker to respond or confirm something before the process can move on.",
      false:
        "Nothing is needed back: an automated confirmation, a scheduled invite that is already booked, a rejection, or a link to self-serve such as an online test.",
    },
  };
}

function dateQuestion(i: number, dates: DateCandidate[]): ChoiceQuestion<string> {
  const criteria: Record<string, string> = {};
  dates.forEach((date, d) => (criteria[`date_${d}`] = `"${date.text}" in: …${date.context}…`));
  criteria.none =
    "None of these. The email gives no confirmed time or deadline, only offers options to choose from, or the dates are about something else.";
  return {
    type: "choice",
    instructions:
      `Which date in \`emails[${i}]\` is the confirmed time of the job seeker's interview or call, ` +
      "or the deadline for their assessment, task or offer response?",
    criteria,
  };
}

function linkQuestion(i: number, links: BodyLink[]): ChoiceQuestion<string> {
  const criteria: Record<string, string> = {};
  links.forEach((link, l) => (criteria[`link_${l}`] = `\`emails[${i}].links[${l}]\`: ${link.text || "(no link text)"}`));
  criteria.none = "None of the links. They only go to company pages, job listings, help pages or social media.";
  return {
    type: "choice",
    instructions:
      `Which of the links in \`emails[${i}].links\` does the job seeker open to join the meeting, start the assessment, ` +
      "book an interview slot, or view and accept the offer?",
    criteria,
  };
}

function readAnswers(email: DetailsInput, i: number, answers: Record<string, Answer>): DetailsResult {
  const date = pick(answers[`date_${i}`], "date_", email.dates);
  const link = pick(answers[`link_${i}`], "link_", email.links);
  const reply = answers[`reply_${i}`];
  return {
    eventAt: date?.at ?? null,
    eventText: date?.text ?? null,
    actionUrl: link?.url ?? null,
    actionText: link?.text || null,
    needsReply: reply?.type === "noul" ? reply.noul : 0,
  };
}

function pick<T>(answer: Answer | undefined, prefix: string, candidates: T[]) {
  if (answer?.type !== "choice" || !answer.choice.startsWith(prefix)) return undefined;
  if ((answer.probabilities[answer.choice] ?? 0) < MIN_PICK_PROBABILITY) return undefined;
  return candidates[Number(answer.choice.slice(prefix.length))];
}
