import { ArrowUpRight01Icon, Loading03Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/cn";
import { hiringManagerTitles, linkedInCompanyPeople } from "~/lib/outreach";
import type { Outreach } from "./people";

export function FindPeople({ company, again }: { company: string; again: boolean }) {
  const fetcher = useFetcher<{ error?: string; notice?: string }>();
  const searching = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post" className="flex flex-col gap-1.5">
      <input type="hidden" name="intent" value="find-people" />
      <Button
        type="submit"
        variant="secondary"
        disabled={searching}
        className="h-9 self-start border-stroke-secondary bg-bg-primary px-3.5 font-sans text-[13.5px] normal-case tracking-normal text-text-primary hover:border-stroke-primary hover:bg-bg-primary"
      >
        <HugeiconsIcon icon={searching ? Loading03Icon : Search01Icon} size={16} strokeWidth={1.5} className={cn(searching && "animate-spin")} />
        {searching ? `Searching ${company}…` : again ? "Search again" : "Find recruiters and hiring managers"}
      </Button>
      {fetcher.data?.notice && <p className="text-[12.5px] text-text-tertiary">{fetcher.data.notice}</p>}
      {fetcher.data?.error && <p className="text-[12.5px] text-red-primary">{fetcher.data.error}</p>}
    </fetcher.Form>
  );
}

export function DomainField({ domain }: { domain: string }) {
  const fetcher = useFetcher<{ error?: string; ok?: boolean }>();
  const [editing, setEditing] = useState(false);
  const saving = fetcher.state !== "idle";

  if (domain && !editing) {
    return (
      <p className="flex items-center gap-1 text-[12.5px] text-text-tertiary">
        Emails at <span className="text-text-secondary">{domain}</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={() => setEditing(true)} className="hover:text-text-primary">
          Change
        </button>
        {fetcher.data?.error && <span className="text-red-primary">· {fetcher.data.error}</span>}
      </p>
    );
  }

  return (
    <fetcher.Form method="post" onSubmit={() => setEditing(false)} className="flex flex-col gap-1.5">
      <input type="hidden" name="intent" value="email-domain" />
      <label htmlFor="email-domain" className="text-[12.5px] text-text-tertiary">
        Company email domain
      </label>
      <div className="flex gap-2">
        <Input id="email-domain" name="domain" defaultValue={domain} placeholder="acme.com" required className="h-8 flex-1 font-sans text-[13px]" />
        <Button type="submit" variant="secondary" disabled={saving} className="h-8 border-stroke-secondary bg-bg-primary px-3 font-sans text-[13px] normal-case tracking-normal text-text-primary hover:border-stroke-primary hover:bg-bg-primary">
          Save
        </Button>
      </div>
      {fetcher.data?.error && <p className="text-[12.5px] text-red-primary">{fetcher.data.error}</p>}
    </fetcher.Form>
  );
}

export function LinkedInSearchLinks({ outreach }: { outreach: Outreach }) {
  const searches = [
    ["Recruiters", "recruitment"],
    ["Hiring managers", hiringManagerTitles(outreach.role)[0]],
  ];
  return (
    <div className="flex flex-col gap-1 text-[12.5px] leading-relaxed text-text-tertiary">
      <p className="flex flex-wrap items-center gap-x-3">
        <span>On LinkedIn:</span>
        {searches.map(([label, keywords]) => (
          <a
            key={label}
            href={linkedInCompanyPeople(outreach.company, keywords)}
            target="_blank"
            rel="noopener noreferrer"
            data-jt-people-for={outreach.applicationId}
            data-jt-label={`${outreach.company} · ${outreach.role}`}
            className="inline-flex items-center gap-0.5 font-medium text-text-secondary hover:text-text-primary"
          >
            {label}
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
          </a>
        ))}
      </p>
      <p>With the extension, a Save button appears on the company's People page.</p>
    </div>
  );
}
