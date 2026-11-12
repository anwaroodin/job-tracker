import { Add01Icon, ArrowUpRight01Icon, Cancel01Icon, Link01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Input } from "~/components/ui/input";
import { StatusBadge } from "~/components/ui/status-badge";
import { shortDate } from "~/components/ui/terminal";
import { cn } from "~/lib/cn";
import { gmailThreadUrl } from "~/lib/gmail";
import { useArrivals } from "~/hooks/use-arrivals";
import type { Suggestion } from "~/types/suggestion";

const SHOWN_AT_FIRST = 5;
const SANS = "font-sans text-[13px] normal-case tracking-normal";

export function ApplicationSuggestions({
  suggestions,
  accountEmail,
}: {
  suggestions: Suggestion[];
  accountEmail: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? suggestions : suggestions.slice(0, SHOWN_AT_FIRST);
  const hidden = suggestions.length - shown.length;
  const isArrival = useArrivals(suggestions.map((s) => s.key));

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        <AnimatePresence initial={false}>
          {shown.map((suggestion) => (
            <SuggestionRow
              key={suggestion.key}
              suggestion={suggestion}
              accountEmail={accountEmail}
              arrived={isArrival(suggestion.key)}
            />
          ))}
        </AnimatePresence>
      </ul>
      {suggestions.length > SHOWN_AT_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((all) => !all)}
          className="cursor-pointer self-start px-4 pb-1 pt-3 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function SuggestionRow({
  suggestion,
  accountEmail,
  arrived,
}: {
  suggestion: Suggestion;
  accountEmail: string;
  arrived: boolean;
}) {
  const fetcher = useFetcher<{ error?: string }>();
  const [company, setCompany] = useState(suggestion.company);
  const [role, setRole] = useState(suggestion.role);
  const busy = fetcher.state !== "idle";
  const intent = fetcher.formData?.get("intent");
  const missing = [!company.trim() && "company", !role.trim() && "role"].filter(Boolean).join(" and ");
  const submit = (fields: Record<string, string>) =>
    fetcher.submit({ emailIds: suggestion.emailIds.join(","), ...fields }, { method: "post" });

  const leaving = busy && (intent === "dismiss-suggestion" || intent === "track" || intent === "link-suggestion");

  return (
    <motion.li
      layout="position"
      initial={arrived ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: leaving ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 border-b border-stroke-secondary px-4 py-4 last:border-0 even:bg-ink/[0.025]",
        arrived && "arrive",
        leaving && "pointer-events-none",
      )}
    >
      <CompanyLogo company={company || suggestion.from} className="size-9 text-[14px]" />
      <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-baseline justify-between gap-4">
        <p title={suggestion.subject} className="min-w-0 truncate font-medium text-text-primary">
          {suggestion.subject || "(No subject)"}
        </p>
        <span className="shrink-0 text-[13px] tabular-nums text-text-tertiary">{shortDate(suggestion.appliedAt)}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-text-tertiary">
        <StatusBadge status={suggestion.category} variant="dot" className="shrink-0 text-[13px]" />
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate">
          From {suggestion.from}
          {suggestion.emailIds.length > 1 && ` · ${suggestion.emailIds.length} emails`}
        </span>
        <span aria-hidden>·</span>
        <a
          href={gmailThreadUrl(accountEmail, suggestion.latestThreadId)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-0.5 text-text-secondary underline-offset-4 transition-colors hover:text-text-primary hover:underline"
        >
          Open in Gmail
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} strokeWidth={1.5} />
        </a>
      </div>

      <div className="mt-3 grid gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center">
        <SuggestionInput label="Company" value={company} onChange={setCompany} />
        <SuggestionInput label="Role" value={role} onChange={setRole} />
        <div className="flex min-w-0 items-center gap-2 md:justify-end">
          {suggestion.existing && (
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={busy}
              title={`Add ${suggestion.emailIds.length === 1 ? "this email" : "these emails"} to ${suggestion.existing.company} / ${suggestion.existing.role}`}
              onClick={() => submit({ intent: "link-suggestion", applicationId: suggestion.existing!.id })}
              className={cn("h-9 min-w-0", SANS)}
            >
              <HugeiconsIcon icon={Link01Icon} size={15} strokeWidth={1.5} />
              <span className="truncate">Link to {suggestion.existing.company}</span>
            </Button>
          )}
          <Button
            type="button"
            size="small"
            disabled={busy || !!missing}
            title={missing ? `Add the ${missing} to track this application` : undefined}
            onClick={() => submit({ intent: "track", company, role, appliedAt: suggestion.appliedAt })}
            className={cn("h-9", SANS)}
          >
            <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={1.5} />
            {busy && intent === "track" ? "Tracking…" : "Track"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss suggestion"
            title="Not an application I want to track"
            disabled={busy}
            onClick={() => submit({ intent: "dismiss-suggestion" })}
            className="size-9"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {missing && (
        <p className="mt-2 text-[13px] text-accent-primary">
          Couldn't find the {missing} in this email. Open it in Gmail and fill {missing.includes(" and ") ? "them" : "it"}{" "}
          in to track.
        </p>
      )}
      {fetcher.data?.error && <p className="mt-2 text-[13px] text-red-primary">{fetcher.data.error}</p>}
      </div>
    </motion.li>
  );
}

function SuggestionInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const empty = !value.trim();
  return (
    <label className="relative min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px] text-text-tertiary">{label}</span>
      <Input
        placeholder={`Add ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          label === "Company" ? "pl-[76px]" : "pl-12",
          "h-9 bg-bg-grouped-primary text-[14px]",
          empty && "border-accent-primary/40 placeholder:text-accent-primary/70 hover:border-accent-primary/60",
        )}
      />
    </label>
  );
}
