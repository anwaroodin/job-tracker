import { ArrowUpRight01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "~/lib/cn";
import { Link } from "react-router";
import { EditDetails } from "~/components/application-detail/edit-details";
import { Button } from "~/components/ui/button";
import { shortDate } from "~/components/ui/terminal";
import { SideBlock } from "~/components/ui/side-block";
import { hostOf } from "~/lib/format/url";
import type { Application } from "~/types/application";

const CORE: { key: "location" | "workType" | "salary"; label: string }[] = [
  { key: "location", label: "location" },
  { key: "workType", label: "work type" },
  { key: "salary", label: "salary" },
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
      <dt className="shrink-0 text-text-tertiary">{label}</dt>
      <dd className="min-w-0 truncate text-right text-text-primary">{children}</dd>
    </div>
  );
}

const listOf = (words: string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} or ${words.at(-1)}`);

export function DetailsPanel({ row }: { row: Application }) {
  const source = hostOf(row.url);
  const missing = CORE.filter((f) => !row[f.key]).map((f) => f.label);

  return (
    <SideBlock title="Details">
      <dl className="flex flex-col gap-2">
      {row.location && <Fact label="Location">{row.location}</Fact>}
      {row.workType && <Fact label="Work type">{row.workType}</Fact>}
      {row.employmentType && <Fact label="Employment">{row.employmentType}</Fact>}
      {row.salary && (
        <Fact label="Salary">
          <span className="text-green-primary">{row.salary}</span>
        </Fact>
      )}
      {row.category && <Fact label="Level">{row.category}</Fact>}
      {row.postedAt && <Fact label="Posted">{shortDate(row.postedAt)}</Fact>}
      {row.applicants && <Fact label="Applicants">{row.applicants}</Fact>}
      <Fact label="Applied">{shortDate(row.appliedAt)}</Fact>
      <Fact label="Updated">{shortDate(row.updatedAt)}</Fact>
      {source && (
        <Fact label="Source">
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-primary underline-offset-4 hover:underline"
          >
            {source} ↗
          </a>
        </Fact>
      )}
      </dl>
      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-stroke-secondary px-3 py-2">
          <span className="font-sans text-[12.5px] text-text-tertiary">
            No {listOf(missing)} yet.
          </span>
          <EditDetails job={row} />
        </div>
      )}
    </SideBlock>
  );
}

export function CvPanel({ applicationId, tailored }: { applicationId: string; tailored: boolean }) {
  return (
    <SideBlock title="CV" aside={tailored ? "Tailored" : undefined}>
      <p className="text-[13.5px] leading-relaxed text-text-secondary">
        {tailored ? "A CV rewritten for this job is ready." : "Rewrite your CV for this job, keeping only what's true."}
      </p>
      <Button
        asChild
        variant={tailored ? "secondary" : "primary"}
        className={cn(
          "h-9 self-start px-3.5 font-sans text-[13.5px] normal-case tracking-normal",
          tailored && "border-stroke-secondary bg-bg-primary text-text-primary hover:border-stroke-primary hover:bg-bg-primary",
        )}
      >
        <Link to={`/applications/${applicationId}/cv`}>
          <HugeiconsIcon icon={tailored ? ArrowUpRight01Icon : File01Icon} size={16} strokeWidth={1.5} />
          {tailored ? "Open tailored CV" : "Tailor CV"}
        </Link>
      </Button>
    </SideBlock>
  );
}

export function NotesPanel({ notes }: { notes: string }) {
  return (
    <SideBlock title="Notes">
      <p className="whitespace-pre-line font-sans text-[13px] leading-relaxed text-text-secondary">
        {notes}
      </p>
    </SideBlock>
  );
}
