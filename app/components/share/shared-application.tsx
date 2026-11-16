import { ArrowUpRight01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { FactChips, listingFacts } from "~/components/application-detail/fact-chips";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Wordmark } from "~/components/shell/wordmark";
import { Button } from "~/components/ui/button";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { RichText } from "~/components/ui/rich-text";
import { Segmented } from "~/components/ui/segmented";
import { PageTitle, stagger } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { hostOf } from "~/lib/format/url";

interface SharedJob {
  company: string;
  role: string;
  location: string;
  workType: string;
  url: string;
  description: string;
  logoUrl?: string | null;
  employmentType: string;
  postedAt: string | null;
  applicants: string;
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function SharedApplication({ job, expiresAt, hasCv, pdfHref, logoToken }: { job: SharedJob; expiresAt: string; hasCv: boolean; pdfHref: string; logoToken: string | null }) {
  const [view, setView] = useState<"job" | "cv">("job");
  const source = hostOf(job.url);
  const facts = listingFacts(job);

  return (
    <div className={cn("min-h-dvh bg-bg-primary text-text-primary", SANS_PAGE)}>
      <header className="border-b border-stroke-secondary">
        <div className="mx-auto flex h-[52px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Wordmark className="h-6 w-auto" />
          <span className="text-[13px] text-text-tertiary">Shared until {longDate(expiresAt)}</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-8 lg:py-12">
        <section className="rise flex flex-wrap items-start justify-between gap-x-8 gap-y-5" style={stagger(0)}>
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo company={job.company} logoUrl={job.logoUrl} token={logoToken} className="mt-0.5 size-12 text-[18px]" />
            <div className="flex min-w-0 flex-col gap-3">
              <PageTitle className="gap-0.5" title={job.company} sub={job.role} />
              {facts.length > 0 && <FactChips facts={facts} />}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {source && (
              <Button asChild variant="secondary">
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  View on {source}
                  <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} strokeWidth={1.5} />
                </a>
              </Button>
            )}
            {hasCv && (
              <Button asChild>
                <a href={pdfHref} target="_blank" rel="noreferrer">
                  <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.5} />
                  Download CV
                </a>
              </Button>
            )}
          </div>
        </section>

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

        <div className={hasCv ? "grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start" : "max-w-3xl"}>
          <div className={cn("rise", view === "cv" && "hidden lg:block")} style={stagger(1)}>
            <PageSection id="description" title="Job description">
              {job.description ? (
                <RichText text={job.description} />
              ) : (
                <p className="text-[13.5px] text-text-tertiary">No job description was saved for this posting.</p>
              )}
            </PageSection>
          </div>

          {hasCv && (
            <div className={cn("rise lg:sticky lg:top-6", view === "job" && "hidden lg:block")} style={stagger(2)}>
              <PageSection id="cv" title="Tailored CV">
                <iframe src={pdfHref} title="Tailored CV" className="block h-[80dvh] w-full border border-stroke-secondary bg-paper" />
              </PageSection>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
