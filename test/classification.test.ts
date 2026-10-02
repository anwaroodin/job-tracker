import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_CATEGORIES } from "~/lib/email";
import { DEFAULT_SETTINGS } from "~/lib/settings";
import {
  activeClassifier,
  classifyEmails,
  isConfident,
  REGEX_CLASSIFIER,
  type ClassifiableEmail,
} from "~/server/email/classify/index.server";
import { classifyEmail } from "~/server/email/classify/rules.server";
import { askJev } from "~/server/jev/client.server";
import { classifyStagesWithJev, type StageInput } from "~/server/jev/email-stage.server";

vi.mock("~/server/jev/client.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  askJev: vi.fn(),
}));

const JEV_ENV = { TYPESAFE_API_KEY: "key" } as Env;
const OPTIONS = { useJev: true, minConfidence: 0.8, readBodies: true };

const email = (id: string, over: Partial<ClassifiableEmail> = {}): ClassifiableEmail => ({
  id,
  subject: "Hello",
  snippet: "Just saying hi",
  fromName: "Recruiter",
  fromAddress: "r@acme.com",
  sentByUser: false,
  ...over,
});

type Answer = { choice: string; confidence: number };

function jevAnswers(byText: Record<string, Answer>) {
  vi.mocked(askJev).mockImplementation(async (_key, state) => {
    const { emails } = state as { emails: { text: string }[] };
    const answers = Object.fromEntries(
      emails.flatMap((e, i) => (byText[e.text] ? [[`email_${i}`, { type: "choice", ...byText[e.text] }]] : [])),
    );
    return { model: "jev-test", answers, inputTokens: 10 } as Awaited<ReturnType<typeof askJev>>;
  });
}

const noBodies = vi.fn(async () => new Map());

beforeEach(() => {
  vi.mocked(askJev).mockReset();
  noBodies.mockClear();
});

describe("isConfident", () => {
  it("treats a missing confidence (keyword rules) as confident", () => {
    expect(isConfident(null, 0.8)).toBe(true);
  });

  it("is inclusive at the threshold", () => {
    expect(isConfident(0.8, 0.8)).toBe(true);
    expect(isConfident(0.79, 0.8)).toBe(false);
  });
});

describe("activeClassifier", () => {
  it("uses Jev only when a key is set, it isn't forced off, and the user picked it", () => {
    expect(activeClassifier(JEV_ENV, DEFAULT_SETTINGS)).toMatch(/^jev:/);
    expect(activeClassifier({} as Env, DEFAULT_SETTINGS)).toBe(REGEX_CLASSIFIER);
    expect(activeClassifier({ ...JEV_ENV, EMAIL_CLASSIFIER: "regex" } as Env, DEFAULT_SETTINGS)).toBe(REGEX_CLASSIFIER);
    expect(activeClassifier(JEV_ENV, { ...DEFAULT_SETTINGS, classifier: "regex" })).toBe(REGEX_CLASSIFIER);
  });
});

describe("classifyEmails", () => {
  it("labels mail the user sent as other, without asking Jev", async () => {
    const { classifications } = await classifyEmails(JEV_ENV, [email("a", { sentByUser: true })], noBodies, OPTIONS);
    expect(classifications.get("a")).toEqual({ category: "other", confidence: null });
    expect(askJev).not.toHaveBeenCalled();
  });

  it("keeps Jev's confidence, so low answers stay unsure", async () => {
    jevAnswers({ "Just saying hi": { choice: "interview", confidence: 0.5 } });
    const { classifications } = await classifyEmails(JEV_ENV, [email("a")], noBodies, { ...OPTIONS, readBodies: false });
    expect(classifications.get("a")).toEqual({ category: "interview", confidence: 0.5 });
  });

  it("re-asks unsure answers with the body, and the body answer wins", async () => {
    jevAnswers({
      "Just saying hi": { choice: "interview", confidence: 0.5 },
      "Full body text": { choice: "rejected", confidence: 0.95 },
    });
    const bodies = vi.fn(async () => new Map([["a", { text: "Full body text", links: [] }]]));
    const { classifications } = await classifyEmails(JEV_ENV, [email("a")], bodies, OPTIONS);
    expect(bodies).toHaveBeenCalledWith(["a"]);
    expect(classifications.get("a")).toEqual({ category: "rejected", confidence: 0.95 });
  });

  it("doesn't fetch bodies for confident answers", async () => {
    jevAnswers({ "Just saying hi": { choice: "offer", confidence: 0.9 } });
    await classifyEmails(JEV_ENV, [email("a")], noBodies, OPTIONS);
    expect(noBodies).not.toHaveBeenCalled();
  });

  it("falls back to keyword rules when Jev fails, and reports the fallback", async () => {
    vi.mocked(askJev).mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejected = email("a", { snippet: "Unfortunately we will not be moving forward" });
    const { classifications, fellBack } = await classifyEmails(JEV_ENV, [rejected], noBodies, OPTIONS);
    expect(classifications.get("a")).toEqual({ category: "rejected", confidence: null });
    expect(fellBack).toEqual(new Set(["a"]));
  });

  it("uses keyword rules without reporting a fallback when Jev isn't in use", async () => {
    const { classifications, fellBack } = await classifyEmails(
      JEV_ENV,
      [email("a", { subject: "Interview invitation" })],
      noBodies,
      { ...OPTIONS, useJev: false },
    );
    expect(classifications.get("a")).toEqual({ category: "interview", confidence: null });
    expect(fellBack.size).toBe(0);
    expect(askJev).not.toHaveBeenCalled();
  });
});

describe("keyword rules", () => {
  it.each([
    ["We are pleased to offer you the role", "offer"],
    ["Unfortunately we have decided to move forward with other candidates", "rejected"],
    ["Thanks for interviewing with us. Unfortunately…", "rejected"],
    ["Please complete the online assessment on HackerRank", "assessment"],
    ["We'd like to invite you to an interview", "interview"],
    ["Can we book a phone screen?", "screening"],
    ["Thank you for applying to Acme", "applied"],
    ["Your weekly job alert", "other"],
  ])("%s → %s", (body, expected) => {
    expect(classifyEmail({ subject: "", body })).toBe(expected);
  });
});

describe("label sets", () => {
  it("Jev is asked to choose between exactly the app's categories", async () => {
    jevAnswers({});
    await classifyStagesWithJev("key", [{ id: "a", from: "", subject: "", text: "x" }], 20, "snippet");
    const questions = vi.mocked(askJev).mock.calls[0][2] as Record<string, { criteria: object }>;
    expect(Object.keys(questions.email_0.criteria).sort()).toEqual([...EMAIL_CATEGORIES].sort());
  });

  it("keyword rules produce only the app's categories", () => {
    const samples = ["offer letter", "unfortunately", "coding challenge", "onsite", "phone screen", "application received", "hi"];
    const produced = new Set(samples.map((body) => classifyEmail({ subject: "", body })));
    expect([...produced].sort()).toEqual([...EMAIL_CATEGORIES].sort());
  });

  it("drops a Jev answer that isn't one of the categories (bug 2.6)", async () => {
    jevAnswers({ x: { choice: "spam", confidence: 0.99 } });
    const input: StageInput = { id: "a", from: "", subject: "", text: "x" };
    const { results } = await classifyStagesWithJev("key", [input], 20, "snippet");
    expect(results.has("a")).toBe(false);
  });
});
