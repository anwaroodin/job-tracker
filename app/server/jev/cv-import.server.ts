import { chunk } from "~/lib/array";
import {
  blockCandidates,
  LINE_KINDS,
  type Block,
  type BlockPicks,
  type LineKind,
  type LineLabel,
} from "../cv/parse";
import type { JevSpend } from "./budget.server";
import { askJev, type ChoiceAnswer, type ChoiceQuestion, type NoulAnswer, type NoulQuestion } from "./client.server";

const LINES_PER_REQUEST = 40;
const BLOCKS_PER_REQUEST = 8;
const MAX_PARALLEL_REQUESTS = 4;
const CONTINUES_AT = 0.5;
const MIN_PICK_PROBABILITY = 0.4;

type Answer = ChoiceAnswer<string> | NoulAnswer;
type Question = ChoiceQuestion<string> | NoulQuestion;

const KIND_CRITERIA: Record<LineKind, string> = {
  heading: "A section heading on its own, such as 'Experience', 'Education', 'Skills', 'Profile' or 'Projects'.",
  entry:
    "Names a job, school, course or project: a job title, an employer, an institution, a qualification, a project name, or the dates or place of one of those. Several of these may share one line.",
  bullet: "Describes what the person did, built or achieved in a particular job, course or project.",
  summary: "Part of a personal profile or summary written about the person as a whole.",
  skills: "Lists skills, tools, languages or technologies.",
  certification: "Names a certificate, licence, award or course completed.",
  contact: "The person's own name, email, phone number, address or links to their profiles.",
  other: "Anything else, such as references, hobbies or page numbers.",
};

async function inParallel<T, R>(items: T[], run: (item: T) => Promise<R>) {
  const out: PromiseSettledResult<R>[] = [];
  for (const group of chunk(items, MAX_PARALLEL_REQUESTS)) out.push(...(await Promise.allSettled(group.map(run))));
  return out;
}

export async function labelLines(apiKey: string, lines: string[], known: Partial<LineLabel>[]) {
  const labels: LineLabel[] = lines.map((_, i) => ({ kind: "other", continues: false, ...known[i] }));
  const spend: JevSpend[] = [];
  let failed = 0;
  const unsure = lines.map((_, i) => i).filter((i) => known[i]?.kind === undefined || known[i]?.continues === undefined);
  const ranges = chunk(unsure, LINES_PER_REQUEST);

  const settled = await inParallel(ranges, async (indexes) => {
    const questions: Record<string, Question> = {};
    for (const i of indexes) {
      if (known[i]?.kind === undefined) {
        questions[`kind_${i}`] = {
          type: "choice",
          instructions: `This is one line of text taken from a CV. What is \`lines[${i}]\`?`,
          criteria: KIND_CRITERIA,
        };
      }
      if (known[i]?.continues === undefined) {
        questions[`cont_${i}`] = {
          type: "noul",
          instructions: `Is \`lines[${i}]\` the rest of \`lines[${i - 1}]\`, cut off only because the text wrapped onto a new line?`,
          criteria: {
            true: "The two lines are one sentence or one list item split across lines.",
            false: "It starts a new item, sentence, heading or entry.",
          },
        };
      }
    }
    return askJev<Answer>(apiKey, { lines }, questions);
  });

  settled.forEach((outcome, r) => {
    if (outcome.status === "rejected") {
      failed++;
      return console.error("jev cv line labelling failed", outcome.reason);
    }
    const { answers, model, inputTokens } = outcome.value;
    spend.push({ model, inputTokens });
    for (const i of ranges[r]) {
      const kind = answers[`kind_${i}`];
      const cont = answers[`cont_${i}`];
      if (kind?.type === "choice" && isKind(kind.choice)) labels[i].kind = kind.choice;
      if (cont?.type === "noul") labels[i].continues = cont.noul >= CONTINUES_AT;
    }
  });
  return { labels, spend, failed };
}

const isKind = (s: string): s is LineKind => (LINE_KINDS as readonly string[]).includes(s);

const FIELDS = {
  experience: [
    ["title", "the job title the person held"],
    ["company", "the employer or organisation they worked for"],
    ["location", "the town, city or country where the job was, or 'Remote'"],
  ],
  education: [
    ["qualification", "the qualification, degree or course studied"],
    ["institution", "the school, college or university"],
    ["location", "the town, city or country where it was"],
  ],
  projects: [],
} as const;

export async function pickEntryFields(apiKey: string, blocks: Block[]) {
  const picks: BlockPicks[] = blocks.map(() => ({}));
  const spend: JevSpend[] = [];
  const candidates = blocks.map(blockCandidates);
  const asked = blocks.map((_, b) => b).filter((b) => candidates[b].length && FIELDS[blocks[b].section].length);
  const groups = chunk(asked, BLOCKS_PER_REQUEST);

  const settled = await inParallel(groups, async (group) => {
    const state = { entries: group.map((b) => ({ lines: blocks[b].lines })) };
    const questions: Record<string, Question> = {};
    group.forEach((b, e) => {
      for (const [field, meaning] of FIELDS[blocks[b].section]) {
        const criteria: Record<string, string> = {};
        candidates[b].forEach((text, c) => (criteria[`c_${c}`] = `"${text}"`));
        criteria.none = "None of these is that.";
        questions[`${field}_${e}`] = {
          type: "choice",
          instructions: `\`entries[${e}].lines\` describe one entry in a CV. Which piece of text is ${meaning}?`,
          criteria,
        };
      }
    });
    return askJev<Answer>(apiKey, state, questions);
  });

  settled.forEach((outcome, g) => {
    if (outcome.status === "rejected") return console.error("jev cv entry picking failed", outcome.reason);
    const { answers, model, inputTokens } = outcome.value;
    spend.push({ model, inputTokens });
    groups[g].forEach((b, e) => {
      for (const [field] of FIELDS[blocks[b].section]) {
        picks[b][field] = pickIndex(answers[`${field}_${e}`]);
      }
    });
  });
  return { picks, spend };
}

function pickIndex(answer: Answer | undefined) {
  if (answer?.type !== "choice" || !answer.choice.startsWith("c_")) return null;
  if ((answer.probabilities[answer.choice] ?? 0) < MIN_PICK_PROBABILITY) return null;
  return Number(answer.choice.slice(2));
}
