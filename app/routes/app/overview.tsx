import type { Route } from "./+types/overview";
import { Link, useRouteLoaderData } from "react-router";
import type { loader as layoutLoader } from "./layout";
import { GettingStarted } from "~/components/onboarding/getting-started";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { analyticsFor } from "~/server/services/overview/analytics.server";
import { upNext } from "~/server/services/overview/up-next.server";
import { CV_COLORS, ColumnChart, pct, shortDate, stagger } from "~/components/ui/terminal";
import { CompanyLogo } from "~/components/applications/company-logo";
import { ListSection } from "~/components/applications/list-section";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { SideBlock, SideRow } from "~/components/ui/side-block";
import { cn } from "~/lib/cn";
import { StatusBadge } from "~/components/ui/status-badge";
import { Pipeline } from "~/components/overview/pipeline";
import { Figures, Verdict } from "~/components/overview/summary";
import { UpNextSection } from "~/components/overview/up-next";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const [analytics, next] = await Promise.all([analyticsFor(db, user.id), upNext(db, user.id)]);
  return { analytics, next };
}

export default function Overview({ loaderData }: Route.ComponentProps) {
  const a = loaderData.analytics;
  const gmailConnected = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail.connected;
  const t = a.totals;
  const peak = Math.max(1, ...a.weekly.map((w) => w.count));
  const upNextTotal = loaderData.next.replies.length + loaderData.next.upcoming.length + loaderData.next.followUps.length;

  return (
    <div className="flex flex-col gap-10 font-sans text-[14px] normal-case tracking-normal">
      <header className="rise" style={stagger(0)}>
        <Verdict totals={t} />
      </header>

      <GettingStarted n="00" gmailConnected={gmailConnected} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">
          {upNextTotal > 0 && <UpNextSection next={loaderData.next} />}

          <ListSection
            title="Recent"
            actions={
              <Link to="/applications" className="text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary">
                See all {t.total}
              </Link>
            }
          >
            <ul className={cn("flex flex-col", INSET_SEPARATORS)}>
              {a.recent.slice(0, 6).map((r) => (
                <li key={r.id} className="relative">
                  <Link to={`/applications/${r.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-ink/[0.04]">
                    <CompanyLogo company={r.company} className="size-9 text-[14px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-primary">{r.company}</p>
                      <p className="truncate text-[12.5px] text-text-tertiary">{r.role}</p>
                    </div>
                    <span className="hidden text-[12.5px] tabular-nums text-text-tertiary sm:block">{shortDate(r.appliedAt)}</span>
                    <StatusBadge status={r.status} variant="dot" className="w-24 shrink-0 text-[12.5px]" />
                  </Link>
                </li>
              ))}
            </ul>
          </ListSection>

          <ListSection title="Volume" count={<span>12 weeks · peak {peak}</span>}>
            <ColumnChart
              peak={peak}
              columns={a.weekly.map((w) => ({ key: w.weekStart, label: w.weekLabel, value: w.count, display: String(w.count) }))}
            />
          </ListSection>
        </div>

        <aside className="flex flex-col gap-5 lg:border-l lg:border-stroke-secondary lg:pl-8">
          <Figures totals={t} />
          {t.total > 0 && <Pipeline analytics={a} />}

          {a.topCompanies.length > 0 && (
            <SideBlock title="Top companies">
              <div className="flex flex-col gap-2">
                {a.topCompanies.slice(0, 4).map((c) => (
                  <SideRow key={c.company} lead={<CompanyLogo company={c.company} className="size-6 text-[11px]" />} label={c.company} value={c.count} />
                ))}
              </div>
            </SideBlock>
          )}

          {a.byCv.length > 0 && (
            <SideBlock title="CV split">
              <div className="flex h-2 w-full gap-[2px]">
                {a.byCv.map((c, i) => (
                  <span key={c.cvType} className="h-full min-w-[2px]" style={{ flexGrow: c.count, background: CV_COLORS[i % CV_COLORS.length] }} />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {a.byCv.map((c, i) => (
                  <SideRow
                    key={c.cvType}
                    lead={<span aria-hidden className="size-2 rounded-full" style={{ background: CV_COLORS[i % CV_COLORS.length] }} />}
                    label={<span className="capitalize">{c.cvType}</span>}
                    note={`${pct(c.count, t.total)}%`}
                    value={c.count}
                  />
                ))}
              </div>
            </SideBlock>
          )}
        </aside>
      </div>
    </div>
  );
}
