import { File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ListSection } from "~/components/applications/list-section";
import { CompanyLogo } from "~/components/applications/company-logo";
import { INSET_SEPARATORS } from "~/components/applications/applications-table";
import { SideBlock } from "~/components/ui/side-block";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { formatDollars } from "~/lib/settings";
import type { loader } from "~/routes/app/usage";
import { DataTable, EmptyState, Figure, SideNote, TwoColumns, percent, seconds, tokens } from "./parts";

type RunAnalytics = Awaited<ReturnType<typeof loader>>["runs"];
type Run = RunAnalytics["recent"][number];

const KIND: Record<string, string> = { tailor: "Tailoring", research: "Company research", prep: "Interview prep", stories: "STAR stories" };
const STATUS_DOT: Record<string, string> = { done: "bg-green-primary", failed: "bg-red-primary", running: "bg-text-tertiary" };

const kindName = (run: { kind: string; pipeline: string | null }) => `${KIND[run.kind] ?? run.kind}${run.pipeline ? ` ${run.pipeline}` : ""}`;
const modelName = (model: string) => model.replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2");

function RunRow({ run }: { run: Run }) {
  const tokensUsed = run.totals.inputTokens + run.totals.cachedTokens + run.totals.outputTokens;
  const meta = [kindName(run), modelName(run.model), run.version ? `version ${run.version}` : null, `${shortDate(run.startedAt)} ${run.startedAt.slice(11, 16)}`];
  return (
    <li className="relative flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-ink/[0.04]">
      {run.label ? (
        <CompanyLogo company={run.label} className="size-8 text-[13px]" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center bg-ink/[0.05] text-text-secondary">
          <HugeiconsIcon icon={File01Icon} size={17} strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{run.label || kindName(run)}</p>
        <p className="truncate text-[12.5px] text-text-tertiary">{meta.filter(Boolean).join(" · ")}</p>
        {run.status === "failed" && run.error && <p className="truncate text-[12.5px] text-red-primary" title={run.error}>{run.error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-4 text-[12.5px] tabular-nums text-text-tertiary">
        <span className="hidden sm:inline">{tokens(tokensUsed)} tokens</span>
        <span className="hidden sm:inline">{formatDollars(run.totals.costUsd)}</span>
        <span title="5-hour limit used">{percent(run.fiveHourUsed)}</span>
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[run.status] ?? STATUS_DOT.running)} />
          {run.status === "done" ? "Done" : run.status === "failed" ? "Failed" : "Running"}
        </span>
      </div>
    </li>
  );
}

export function ClaudeRuns({ analytics }: { analytics: RunAnalytics }) {
  const { summary, variants, stages, recent, windowDays } = analytics;
  if (!recent.length) {
    return <EmptyState title="No Claude runs yet">Tailoring, company research and interview prep show up here from your next run.</EmptyState>;
  }

  const main = (
    <>
      <ListSection title="By version and model" count="average per finished run">
        <DataTable
          minWidth={640}
          columns={[
            { label: "Run", width: "minmax(170px,1.6fr)" },
            { label: "Runs", width: "56px", align: "right" },
            { label: "In", width: "64px", align: "right" },
            { label: "Cached", width: "64px", align: "right" },
            { label: "Out", width: "64px", align: "right" },
            { label: "Cost", width: "76px", align: "right" },
            { label: "5-hour", width: "64px", align: "right" },
            { label: "Time", width: "64px", align: "right" },
          ]}
          rows={variants.map((v) => ({
            key: `${v.kind}-${v.pipeline}-${v.model}`,
            cells: [
              `${kindName(v)} · ${modelName(v.model)}`,
              v.failed ? `${v.done} of ${v.runs}` : v.runs,
              tokens(v.perRun.inputTokens),
              tokens(v.perRun.cachedTokens),
              tokens(v.perRun.outputTokens),
              formatDollars(v.perRun.costUsd),
              percent(v.fiveHourPerRun),
              seconds(v.perRun.durationMs),
            ],
          }))}
        />
      </ListSection>

      <ListSection title="By stage" count="average per call">
        <DataTable
          minWidth={640}
          columns={[
            { label: "Stage", width: "minmax(170px,1.6fr)" },
            { label: "Calls", width: "56px", align: "right" },
            { label: "Prompt", width: "72px", align: "right" },
            { label: "In", width: "64px", align: "right" },
            { label: "Out", width: "64px", align: "right" },
            { label: "Cost", width: "76px", align: "right" },
            { label: "Time", width: "64px", align: "right" },
          ]}
          rows={[...stages]
            .sort((a, b) => kindName(a).localeCompare(kindName(b)))
            .map((s) => ({
              key: `${s.kind}-${s.pipeline}-${s.stage}`,
              cells: [
                <span key="n" title={s.models.map(modelName).join(", ")}>
                  {`${kindName(s)} · ${s.stage}`}
                  {s.failed > 0 && <span className="text-red-primary"> · {s.failed} failed</span>}
                </span>,
                s.calls,
                `${tokens(s.inputChars)} chars`,
                tokens(s.perCall.inputTokens + s.perCall.cachedTokens),
                tokens(s.perCall.outputTokens),
                formatDollars(s.perCall.costUsd),
                seconds(s.perCall.durationMs),
              ],
            }))}
        />
      </ListSection>

      <ListSection title="Recent runs" count={summary.runs > recent.length ? `latest ${recent.length} of ${summary.runs}` : recent.length}>
        <ul className={cn("flex flex-col", INSET_SEPARATORS)}>
          {recent.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      </ListSection>
    </>
  );

  const t = summary.totals;
  const aside = (
    <>
      <SideBlock title={`Last ${windowDays} days`}>
        <Figure label="Runs" value={summary.runs} />
        <Figure label="Finished" value={summary.done} />
        <Figure label="Failed" value={summary.failed} tone={summary.failed ? "bad" : undefined} />
        <Figure label="Tokens in" value={tokens(t.inputTokens)} />
        <Figure label="Read from cache" value={tokens(t.cachedTokens)} />
        <Figure label="Tokens out" value={tokens(t.outputTokens)} />
        <Figure label="At API prices" value={formatDollars(t.costUsd)} />
        <Figure label="5-hour limit used" value={percent(summary.fiveHourUsed)} />
      </SideBlock>
      <SideBlock title="About these numbers">
        <SideNote>
          Runs use your own Claude subscription through the runner, so nothing is billed per token. The cost is what the same tokens would cost on the API, which is the
          easiest way to compare runs. Limit percentages also count anything else you used Claude for during a run.
        </SideNote>
      </SideBlock>
    </>
  );

  return <TwoColumns main={main} aside={aside} />;
}
