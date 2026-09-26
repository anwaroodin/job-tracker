import { chunk } from "~/lib/array";
import type { EmailCategory } from "../email/classify.server";
import { askJev, type ChoiceAnswer, type ChoiceQuestion } from "./client.server";

export const JEV_STAGE_VERSION = 1;

const MAX_PARALLEL_REQUESTS = 4;

export interface StageInput {
  id: string;
  from: string;
  subject: string;
  text: string;
}

export interface StageResult {
  category: EmailCategory;
  confidence: number;
}

export type StageSource = "snippet" | "body" | "details" | "suggestions";

export interface StageUsage {
  source: StageSource;
  emails: number;
  inputTokens: number;
  model: string;
}

const CRITERIA: Record<EmailCategory, unknown> = {
  applied: {
    what: "Confirms that an application was received or submitted, including job board confirmations such as LinkedIn or Indeed.",
    not_for: "Emails that already invite the job seeker to a call, test or interview.",
  },
  screening: {
    what: "Invites the job seeker to an initial recruiter call, phone screen or introductory chat about a role they applied to.",
    not_for: "Interviews with the hiring team; unsolicited outreach about roles they never applied to.",
  },
  interview: {
    what: "Invites, schedules, confirms or reschedules an interview with the hiring team, including onsite, panel and final rounds.",
    not_for: "Initial recruiter screens; rejections sent after an interview.",
  },
  assessment: {
    what: "Asks the job seeker to complete a test: online assessment, coding challenge, take-home task, psychometric test or recorded video interview.",
  },
  offer: {
    what: "Extends, confirms or negotiates a job offer to the job seeker.",
  },
  rejected: {
    what: "Tells the job seeker their application will not progress, or that the role is filled or closed.",
    not_for: "Delays, reschedules or apologies that use words like 'unfortunately' without ending the application.",
  },
  other: {
    what: "Not an update on one of the job seeker's own applications.",
    examples: ["Job alerts and recommendations", "Newsletters and marketing", "Unsolicited recruiter outreach", "Account or security notifications"],
  },
};

function stageQuestion(index: number): ChoiceQuestion<EmailCategory> {
  return {
    type: "choice",
    instructions:
      `A job seeker received \`emails[${index}]\`. Which stage of the job seeker's own application does that email represent? ` +
      "Judge only that email, by what the sender is telling or asking the job seeker, not by individual words.",
    criteria: CRITERIA,
  };
}

export async function classifyStagesWithJev(
  apiKey: string,
  emails: StageInput[],
  perRequest: number,
  source: StageSource,
) {
  const results = new Map<string, StageResult>();
  const usage: StageUsage[] = [];
  const batches = chunk(emails, perRequest);
  for (const group of chunk(batches, MAX_PARALLEL_REQUESTS)) {
    const settled = await Promise.allSettled(group.map((batch) => classifyBatch(apiKey, batch)));
    settled.forEach((outcome, i) => {
      if (outcome.status === "rejected") return console.error("jev classification failed", outcome.reason);
      const { model, inputTokens, classified } = outcome.value;
      for (const [id, result] of classified) results.set(id, result);
      usage.push({ source, emails: group[i].length, inputTokens, model });
    });
  }
  return { results, usage };
}

async function classifyBatch(apiKey: string, batch: StageInput[]) {
  const state = { emails: batch.map(({ from, subject, text }) => ({ from, subject, text })) };
  const questions = Object.fromEntries(batch.map((_, i) => [`email_${i}`, stageQuestion(i)]));
  const { model, answers, inputTokens } = await askJev<ChoiceAnswer<EmailCategory>>(apiKey, state, questions);
  const classified = batch.flatMap((email, i) => {
    const answer = answers[`email_${i}`];
    return answer ? [[email.id, { category: answer.choice, confidence: answer.confidence }] as const] : [];
  });
  return { model, inputTokens, classified };
}
