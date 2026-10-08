const STRINGS = { type: "array", items: { type: "string" } };

const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const KEYWORDS_SCHEMA = object({
  company: { type: "string" },
  role: { type: "string" },
  required_skills: STRINGS,
  preferred_skills: STRINGS,
  experience_requirements: STRINGS,
  education_requirements: STRINGS,
  key_responsibilities: STRINGS,
  keywords: STRINGS,
  experience_years: { type: ["number", "null"] },
  seniority_level: { type: "string" },
});

export const PLAN_SCHEMA = object({
  target_skills: { type: "array", items: object({ skill: { type: "string" }, reason: { type: "string" } }) },
  projects: { type: "array", items: { type: "integer" } },
  strategy_notes: { type: "string" },
});

export const DIFFS_SCHEMA = object({
  changes: {
    type: "array",
    items: object({
      path: { type: "string" },
      action: { type: "string", enum: ["replace", "append", "reorder", "add_skill"] },
      original: { type: ["string", "null"] },
      value: { anyOf: [{ type: "string" }, STRINGS] },
      reason: { type: "string" },
    }),
  },
  strategy_notes: { type: "string" },
});

const ENTRY = object({ description: STRINGS });

export const INJECT_SCHEMA = object({
  summary: { type: "string" },
  workExperience: { type: "array", items: ENTRY },
  personalProjects: { type: "array", items: ENTRY },
  education: { type: "array", items: ENTRY },
  skills: { type: "array", items: object({ label: { type: "string" }, items: STRINGS }) },
});

export const LETTER_SCHEMA = object({
  greeting: { type: "string" },
  paragraphs: STRINGS,
  signOff: { type: "string" },
});

export const EMPHASIS_SCHEMA = object({
  emphasis: { type: "array", items: object({ path: { type: "string" }, phrases: STRINGS }) },
});
