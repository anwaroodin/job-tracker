import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/usage";
import { PageTitle, stagger } from "~/components/ui/terminal";
import { SANS_PAGE } from "~/components/ui/page-section";
import { cn } from "~/lib/cn";
import { formatDollars } from "~/lib/settings";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { usageDashboard } from "~/server/db/queries/usage.server";
import { activeClassifier, jevAvailable } from "~/server/email/classify/index.server";
import { DOLLARS_PER_INPUT_TOKEN } from "~/server/jev/client.server";
import { outreachMonth } from "~/server/services/outreach/budget.server";
import { runAnalytics } from "~/server/services/runs/analytics.server";
import { ClaudeRuns } from "~/components/usage/run-analytics";
import { ContactLookups } from "~/components/usage/contact-lookups";
import { EmailSorting } from "~/components/usage/email-sorting";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [usage, outreach, runs] = await Promise.all([usageDashboard(db, user.id), outreachMonth(env, db), runAnalytics(db, user.id)]);
  const { settings } = usage;
  return {
    usage,
    outreach,
    runs,
    settings,
    jevOn: activeClassifier(env, settings).startsWith("jev"),
    jevAvailable: jevAvailable(env),
    pricePerMillion: DOLLARS_PER_INPUT_TOKEN * 1_000_000,
  };
}

const TABS = [
  { key: "claude", label: "CV tailoring and prep" },
  { key: "jev", label: "Email sorting" },
  { key: "lookups", label: "Contact lookups" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function Usage({ loaderData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const tab: Tab = TABS.some((t) => t.key === params.get("tab")) ? (params.get("tab") as Tab) : "claude";
  const { usage, outreach, runs } = loaderData;
  const lookupSpend = outreach.reduce((sum, p) => sum + p.cost, 0);
  const counts: Record<Tab, string> = {
    claude: String(runs.summary.runs),
    jev: formatDollars(usage.month.cost),
    lookups: formatDollars(lookupSpend),
  };

  return (
    <div className={`flex flex-col gap-8 ${SANS_PAGE}`}>
      <header className="rise flex flex-col gap-5" style={stagger(0)}>
        <PageTitle
          title="Usage"
          sub={`${runs.summary.runs} Claude ${runs.summary.runs === 1 ? "run" : "runs"} in ${runs.windowDays} days · ${formatDollars(usage.month.cost)} on Jev and ${formatDollars(lookupSpend)} on contact lookups this month`}
        />
        <nav aria-label="Usage" className="flex flex-wrap items-center gap-1">
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <Link
                key={t.key}
                to={`?tab=${t.key}`}
                replace
                preventScrollReset
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 px-3 text-[13px] font-medium transition-colors",
                  on ? "bg-ink/[0.07] text-text-primary" : "text-text-tertiary hover:bg-ink/[0.04] hover:text-text-primary",
                )}
              >
                {t.label}
                <span className="tabular-nums text-text-tertiary">{counts[t.key]}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="rise" style={stagger(1)}>
        {tab === "claude" && <ClaudeRuns analytics={runs} />}
        {tab === "jev" && <EmailSorting data={loaderData} />}
        {tab === "lookups" && <ContactLookups lookups={outreach} />}
      </div>
    </div>
  );
}
