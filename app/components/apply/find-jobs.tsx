import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import { Link, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { JobSearch } from "~/lib/job-search";
import type { action } from "~/routes/app/apply";

const label = "text-[12.5px] text-text-tertiary";

export function SearchLinks({ searches }: { searches: JobSearch[] }) {
  if (!searches.length) {
    return (
      <p className="text-[13px] text-text-tertiary">
        Add the roles you're after to{" "}
        <Link to="/cv" className="font-medium text-text-secondary hover:text-text-primary">
          your CV
        </Link>{" "}
        and searches for them show up here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {searches.map((search) => (
        <li key={search.role} className="flex flex-col gap-1">
          <span className="truncate text-[13.5px] text-text-secondary">{search.role}</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {search.links.map((link) => (
              <a key={link.site} href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-[12.5px] font-medium text-text-tertiary hover:text-text-primary">
                {link.site} <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} strokeWidth={1.5} />
              </a>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AddJob() {
  const fetcher = useFetcher<typeof action>();
  const form = useRef<HTMLFormElement>(null);
  const result = fetcher.data;
  const busy = fetcher.state !== "idle";
  const prefill = result && "job" in result ? result.job : undefined;

  useEffect(() => {
    if (result && "added" in result) form.current?.reset();
  }, [result]);

  return (
    <fetcher.Form ref={form} method="post" className="flex flex-col gap-3">
      <input type="hidden" name="intent" value="add-job" />
      <label className="flex flex-col gap-1.5">
        <span className={label}>Job description</span>
        <textarea
          name="description"
          rows={5}
          placeholder="Paste the whole posting. The company, role and details are read from it."
          className="min-h-28 w-full resize-y border border-stroke-secondary bg-bg-primary px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-tertiary focus:border-stroke-primary focus:outline-none [field-sizing:content]"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Link</span>
          <Input name="url" type="url" placeholder="https://" defaultValue={prefill?.url} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Company</span>
          <Input name="company" placeholder="Read from the posting" defaultValue={prefill?.company} key={`company-${prefill?.company}`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Role</span>
          <Input name="role" placeholder="Read from the posting" defaultValue={prefill?.role} key={`role-${prefill?.role}`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy} className="h-9 px-3.5 text-[13.5px]">
          {busy ? "Reading…" : "Add to the queue"}
        </Button>
        {result && "error" in result && <p className="text-[13px] text-red-primary">{result.error}</p>}
        {result && "added" in result && <p className="text-[13px] text-green-primary">Added {result.added}.</p>}
      </div>
    </fetcher.Form>
  );
}

export function FindJobs({ searches, empty }: { searches: JobSearch[]; empty: boolean }) {
  return (
    <section className="flex flex-col gap-6 border border-stroke-secondary p-5">
      <div>
        <p className="font-medium text-text-primary">{empty ? "Your queue is empty. Find a few jobs to apply to" : "Find more jobs"}</p>
        <p className="text-[13px] text-text-tertiary">Search for postings from the last week, then paste one here, or save it with the browser extension.</p>
      </div>
      <SearchLinks searches={searches} />
      <div className="border-t border-stroke-secondary pt-5">
        <AddJob />
      </div>
    </section>
  );
}
