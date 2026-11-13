import { Download } from "lucide-react";
import { useState } from "react";
import { FactChips } from "~/components/application-detail/fact-chips";
import { Button } from "~/components/ui/button";
import { RichText } from "~/components/ui/rich-text";
import { Segmented } from "~/components/ui/segmented";
import { PageTitle, Section, fmtDate, stagger } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { hostOf } from "~/lib/format/url";

interface SharedJob {
  company: string;
  role: string;
  location: string;
  workType: string;
  url: string;
  description: string;
}

export function SharedApplication({ job, expiresAt, hasCv, pdfHref }: { job: SharedJob; expiresAt: string; hasCv: boolean; pdfHref: string }) {
  const [view, setView] = useState<"job" | "cv">("job");
  const source = hostOf(job.url);
  const facts = [
    { key: "location", text: job.location },
    { key: "workType", text: job.workType },
  ].filter((f) => f.text);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 font-mono text-[12.5px] uppercase tracking-[0.04em] sm:px-8 lg:py-12">
      <header className="rise flex flex-wrap items-end justify-between gap-6" style={stagger(0)}>
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">Shared until {fmtDate(expiresAt)}</p>
          <PageTitle className="mt-4" title={job.company} sub={job.role} />
          <FactChips facts={facts} className="mt-4" />
        </div>
        {hasCv && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] tracking-[0.1em] text-text-tertiary">Includes a tailored CV</span>
            <Button asChild size="small">
              <a href={pdfHref} target="_blank" rel="noreferrer">
                <Download />
                Download CV
              </a>
            </Button>
          </div>
        )}
      </header>

      {hasCv && (
        <div className="lg:hidden">
          <Segmented
            label="Show"
            options={[
              { value: "job", label: "Job description" },
              { value: "cv", label: "Tailored CV" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      )}

      <div className={hasCv ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start" : "max-w-3xl"}>
        <Section
          n="01"
          title="Job description"
          hint={
            source && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="normal-case text-accent-primary transition-colors hover:text-accent-secondary">
                {source} ↗
              </a>
            )
          }
          i={1}
          className={cn(view === "cv" && "hidden lg:block")}
        >
          {job.description ? (
            <RichText text={job.description} />
          ) : (
            <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">No job description was saved for this posting.</p>
          )}
        </Section>

        {hasCv && (
          <Section
            n="02"
            title="Tailored CV"
            i={2}
            className={cn("lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:pr-1", view === "job" && "hidden lg:block")}
          >
            <iframe src={pdfHref} title="Tailored CV" className="block h-[80dvh] w-full border border-stroke-secondary bg-paper" />
          </Section>
        )}
      </div>
    </main>
  );
}
