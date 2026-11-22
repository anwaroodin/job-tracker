import { companyCandidates, type JobFromPdf, readJobText, roleCandidates } from "~/lib/job-pdf";
import type { JevSpend } from "./budget.server";
import { askJev, type ChoiceAnswer, type ChoiceQuestion } from "./client.server";

const MAX_TEXT_CHARS = 6000;
const MIN_PICK_PROBABILITY = 0.4;

const WORK_TYPES = { remote: "Remote", hybrid: "Hybrid", on_site: "On-site" } as const;
const EMPLOYMENT_TYPES = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  fixed_term: "Fixed-term",
  internship: "Internship",
  temporary: "Temporary",
} as const;

const optionsQuestion = (instructions: string, options: string[], none: string): ChoiceQuestion<string> => ({
  type: "choice",
  instructions,
  criteria: { ...Object.fromEntries(options.map((option, i) => [`option_${i}`, option])), none },
});

const fixedQuestion = (instructions: string, options: Record<string, string>, none: string): ChoiceQuestion<string> => ({
  type: "choice",
  instructions,
  criteria: { ...options, none },
});

function picked(answer: ChoiceAnswer<string> | undefined) {
  if (!answer || answer.choice === "none" || (answer.probabilities[answer.choice] ?? 0) < MIN_PICK_PROBABILITY) return undefined;
  return answer.choice;
}

export async function readJobWithJev(apiKey: string, text: string): Promise<{ job: JobFromPdf; spend: JevSpend[] }> {
  const { job, labelled, lines } = readJobText(text);
  const companies = companyCandidates(lines);
  const roles = roleCandidates(lines);
  const questions: Record<string, ChoiceQuestion<string>> = {};

  if (!labelled.has("company") && companies.length) {
    questions.company = optionsQuestion(
      "Which of these is the name of the company that is hiring for the job described in `description`?",
      companies,
      "None of these. The hiring company isn't named, for example a recruiter writing about 'our client', or these are other companies.",
    );
  }
  if (!labelled.has("role") && roles.length) {
    questions.role = optionsQuestion("Which of these lines of `description` is the title of the job being advertised?", roles, "None of these lines is the job title.");
  }
  if (!labelled.has("workType")) {
    questions.workType = fixedQuestion(
      "Where does the person in the job described in `description` work?",
      { remote: "Fully remote.", hybrid: "Partly from home and partly in an office.", on_site: "At the office or site every day." },
      "The description doesn't say.",
    );
  }
  if (!labelled.has("employmentType")) {
    questions.employmentType = fixedQuestion(
      "What kind of employment is the job described in `description`?",
      {
        full_time: "A permanent full-time job.",
        part_time: "A part-time job.",
        contract: "A contract or freelance role, often paid by the day.",
        fixed_term: "A fixed-term employment contract for a set period.",
        internship: "An internship, placement or work experience.",
        temporary: "Temporary or seasonal work.",
      },
      "The description doesn't say.",
    );
  }
  if (!Object.keys(questions).length) return { job, spend: [] };

  const { answers, model, inputTokens } = await askJev<ChoiceAnswer<string>>(apiKey, { description: job.description.slice(0, MAX_TEXT_CHARS) }, questions);
  const option = (key: string, options: string[]) => {
    const choice = picked(answers[key]);
    return choice?.startsWith("option_") ? options[Number(choice.slice("option_".length))] : undefined;
  };
  const work = picked(answers.workType) as keyof typeof WORK_TYPES | undefined;
  const employment = picked(answers.employmentType) as keyof typeof EMPLOYMENT_TYPES | undefined;

  return {
    job: {
      ...job,
      company: questions.company ? (option("company", companies) ?? "") : job.company,
      role: option("role", roles) ?? job.role,
      workType: (work && WORK_TYPES[work]) || job.workType,
      employmentType: (employment && EMPLOYMENT_TYPES[employment]) || job.employmentType,
    },
    spend: [{ model, inputTokens }],
  };
}
