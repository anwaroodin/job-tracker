const API_URL = "https://api.typesafe.ai/v1/systemone";

export const DOLLARS_PER_INPUT_TOKEN = 0.042 / 1_000_000;
const MODEL = "jev-latest";
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [500, 1500];
const RETRYABLE = new Set([429, 500, 502, 503, 529]);

export interface ChoiceQuestion<K extends string> {
  type: "choice";
  instructions: string;
  criteria: Record<K, unknown>;
}

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface ChoiceAnswer<K extends string> {
  type: "choice";
  choice: K;
  probabilities: Record<K, number>;
  confidence: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

interface ApiResponse<A> {
  model: string;
  answers: Record<string, A>;
  usage: { input_tokens: number };
}

export interface JevResponse<A> {
  model: string;
  answers: Record<string, A>;
  inputTokens: number;
}

export async function askJev<A>(
  apiKey: string,
  state: unknown,
  questions: Record<string, ChoiceQuestion<string> | NoulQuestion>,
): Promise<JevResponse<A>> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) {
      const body = (await res.json()) as ApiResponse<A>;
      return { model: body.model, answers: body.answers, inputTokens: body.usage?.input_tokens ?? 0 };
    }

    const delay = RETRY_DELAYS_MS[attempt];
    if (!RETRYABLE.has(res.status) || delay === undefined) {
      throw new Error(`Jev request failed: ${res.status} ${await res.text()}`);
    }
    await new Promise((r) => setTimeout(r, delay));
  }
}
