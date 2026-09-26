export const CLASSIFIERS = ["jev", "regex"] as const;
export const CONFIDENCE_LEVELS = [0.6, 0.7, 0.8, 0.9, 0.95] as const;

export type Classifier = (typeof CLASSIFIERS)[number];

export interface Settings {
  classifier: Classifier;
  minConfidence: number;
  readBodies: boolean;
  extractDetails: boolean;
  suggestApplications: boolean;
  monthlyBudget: number | null;
  autoSync: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  classifier: "jev",
  minConfidence: 0.8,
  readBodies: true,
  extractDetails: true,
  suggestApplications: true,
  monthlyBudget: null,
  autoSync: true,
};

export function parseSettings(raw: unknown): Settings {
  const input = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const budget = Number(input.monthlyBudget);
  return {
    classifier: CLASSIFIERS.includes(input.classifier as Classifier)
      ? (input.classifier as Classifier)
      : DEFAULT_SETTINGS.classifier,
    minConfidence: CONFIDENCE_LEVELS.includes(input.minConfidence as (typeof CONFIDENCE_LEVELS)[number])
      ? (input.minConfidence as number)
      : DEFAULT_SETTINGS.minConfidence,
    readBodies: typeof input.readBodies === "boolean" ? input.readBodies : DEFAULT_SETTINGS.readBodies,
    extractDetails:
      typeof input.extractDetails === "boolean" ? input.extractDetails : DEFAULT_SETTINGS.extractDetails,
    suggestApplications:
      typeof input.suggestApplications === "boolean"
        ? input.suggestApplications
        : DEFAULT_SETTINGS.suggestApplications,
    monthlyBudget: input.monthlyBudget === null || input.monthlyBudget === "" || !(budget >= 0) ? null : budget,
    autoSync: typeof input.autoSync === "boolean" ? input.autoSync : DEFAULT_SETTINGS.autoSync,
  };
}

export function formatDollars(amount: number) {
  if (amount === 0) return "$0";
  if (amount < 0.0001) return "<$0.0001";
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
