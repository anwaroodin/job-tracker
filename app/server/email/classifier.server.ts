import type { Settings } from "~/lib/settings";
import type { EmailBody } from "../gmail/api.server";
import { classifyStagesWithJev, JEV_STAGE_VERSION, type StageInput, type StageUsage } from "../jev/email-stage.server";
import { CLASSIFIER_VERSION, classifyEmail, type EmailCategory } from "./classify.server";

const SNIPPETS_PER_REQUEST = 20;
const BODIES_PER_REQUEST = 8;
const BODY_CHARS_FOR_CLASSIFYING = 2000;

export interface ClassifiableEmail {
  id: string;
  subject: string;
  snippet: string;
  fromName: string;
  fromAddress: string;
  sentByUser: boolean;
}

export interface Classification {
  category: EmailCategory;
  confidence: number | null;
}

export interface ClassifyOptions {
  useJev: boolean;
  minConfidence: number;
  readBodies: boolean;
}

export type FetchBodies = (ids: string[]) => Promise<Map<string, EmailBody>>;

export function jevAvailable(env: Env) {
  return !!env.TYPESAFE_API_KEY && env.EMAIL_CLASSIFIER !== "regex";
}

export function activeClassifier(env: Env, settings: Settings) {
  return jevAvailable(env) && settings.classifier === "jev" ? `jev:${JEV_STAGE_VERSION}` : `regex:${CLASSIFIER_VERSION}`;
}

export function isConfident(confidence: number | null, minConfidence: number) {
  return confidence === null || confidence >= minConfidence;
}

export async function classifyEmails(
  env: Env,
  emails: ClassifiableEmail[],
  fetchBodies: FetchBodies,
  options: ClassifyOptions,
) {
  const classifications = new Map<string, Classification>();
  const incoming = emails.filter((e) => !e.sentByUser);
  for (const e of emails) if (e.sentByUser) classifications.set(e.id, { category: "other", confidence: null });

  const apiKey = env.TYPESAFE_API_KEY;
  const jev =
    options.useJev && apiKey && incoming.length
      ? await classifyWithJev(apiKey, incoming, fetchBodies, options)
      : { results: new Map<string, Classification>(), usage: [] };
  const fellBack = new Set<string>();
  for (const e of incoming) {
    const result = jev.results.get(e.id);
    if (!result && options.useJev) fellBack.add(e.id);
    classifications.set(e.id, result ?? byRegex(e));
  }
  return { classifications, usage: jev.usage, fellBack };
}

async function classifyWithJev(
  apiKey: string,
  emails: ClassifiableEmail[],
  fetchBodies: FetchBodies,
  { minConfidence, readBodies }: ClassifyOptions,
) {
  const fromSnippets = await classifyStagesWithJev(
    apiKey,
    emails.map((e) => stageInput(e, e.snippet)),
    SNIPPETS_PER_REQUEST,
    "snippet",
  );

  const unsure = emails.filter((e) => {
    const result = fromSnippets.results.get(e.id);
    return result && !isConfident(result.confidence, minConfidence);
  });
  if (!readBodies || !unsure.length) return fromSnippets;

  const bodies = await fetchBodies(unsure.map((e) => e.id)).catch((error) => {
    console.error("fetching email bodies failed", error);
    return new Map<string, EmailBody>();
  });
  const withBody = unsure.flatMap((e) => {
    const text = bodies.get(e.id)?.text.slice(0, BODY_CHARS_FOR_CLASSIFYING);
    return text ? [stageInput(e, text)] : [];
  });
  const fromBodies = await classifyStagesWithJev(apiKey, withBody, BODIES_PER_REQUEST, "body");
  return {
    results: new Map([...fromSnippets.results, ...fromBodies.results]),
    usage: [...fromSnippets.usage, ...fromBodies.usage] satisfies StageUsage[],
  };
}

function stageInput(email: ClassifiableEmail, text: string): StageInput {
  return { id: email.id, from: `${email.fromName} <${email.fromAddress}>`, subject: email.subject, text };
}

function byRegex(email: ClassifiableEmail): Classification {
  return { category: classifyEmail({ subject: email.subject, body: email.snippet }), confidence: null };
}
