import type { Db } from "../../db/client.server";
import { outreachSpendSince } from "../../db/queries/outreach-usage.server";
import { monthStart } from "../../db/queries/usage.server";

export const BRAVE_COST_PER_SEARCH = 0.005;
const DEFAULT_MONTHLY_BUDGET_USD = 5;

export type OutreachProvider = "brave" | "generect";

export function monthlyBudgets(env: Env): Record<OutreachProvider, number> {
  const budget = (value: string | undefined) => (Number.isFinite(Number(value)) && value ? Number(value) : DEFAULT_MONTHLY_BUDGET_USD);
  return { brave: budget(env.BRAVE_MONTHLY_BUDGET_USD), generect: budget(env.GENERECT_MONTHLY_BUDGET_USD) };
}

export async function outreachMonth(env: Env, db: Db) {
  const rows = await outreachSpendSince(db, monthStart());
  const budgets = monthlyBudgets(env);
  const providers: OutreachProvider[] = ["brave", "generect"];
  return providers.map((provider) => {
    const row = rows.find((spend) => spend.provider === provider);
    const cost = row?.cost ?? 0;
    return { provider, requests: row?.requests ?? 0, found: row?.found ?? 0, cost, budget: budgets[provider], overBudget: cost >= budgets[provider] };
  });
}

export async function canSpend(env: Env, db: Db, provider: OutreachProvider) {
  return !(await outreachMonth(env, db)).find((month) => month.provider === provider)?.overBudget;
}
