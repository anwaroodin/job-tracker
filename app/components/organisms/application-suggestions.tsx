import { Link2, Plus, X } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/atoms/button";
import { Input } from "~/components/atoms/input";
import { fmtDate } from "~/components/molecules/terminal";
import { cn } from "~/lib/cn";
import { gmailThreadUrl } from "~/lib/gmail";
import type { Suggestion } from "~/server/db/emails.server";

const SHOWN_AT_FIRST = 5;

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

  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {shown.map((suggestion) => (
          <SuggestionRow key={suggestion.key} suggestion={suggestion} accountEmail={accountEmail} />
        ))}
      </ul>
      {suggestions.length > SHOWN_AT_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((all) => !all)}
          className="self-start pt-3 text-[11px] uppercase tracking-[0.08em] text-text-secondary transition-colors hover:text-text-primary"
        >
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function SuggestionRow({ suggestion, accountEmail }: { suggestion: Suggestion; accountEmail: string }) {
  const fetcher = useFetcher<{ error?: string }>();
  const [company, setCompany] = useState(suggestion.company);
  const [role, setRole] = useState(suggestion.role);
  const busy = fetcher.state !== "idle";
  const intent = fetcher.formData?.get("intent");
  const missing = [!company.trim() && "company", !role.trim() && "role"].filter(Boolean).join(" and ");
  const submit = (fields: Record<string, string>) =>
    fetcher.submit({ emailIds: suggestion.emailIds.join(","), ...fields }, { method: "post" });

  if (busy && intent === "dismiss-suggestion") return null;

  return (
    <li className="border-b border-stroke-secondary py-3.5 last:border-0">
      <div className="grid gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_300px] md:items-center">
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
              className="min-w-0"
            >
              <Link2 />
              <span className="truncate">Link to {suggestion.existing.company}</span>
            </Button>
          )}
          <Button
            type="button"
            size="small"
            disabled={busy || !!missing}
            title={missing ? `Add the ${missing} to track this application` : undefined}
            onClick={() => submit({ intent: "track", company, role, appliedAt: suggestion.appliedAt })}
          >
            <Plus />
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
          >
            <X />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex min-w-0 items-baseline gap-3 text-[10.5px] tracking-[0.08em] text-text-tertiary">
        <p className="min-w-0 flex-1 truncate">
          {fmtDate(suggestion.appliedAt)} · {suggestion.from}
          {suggestion.emailIds.length > 1 && ` · ${suggestion.emailIds.length} emails`} ·{" "}
          <span className="font-sans normal-case tracking-normal">{suggestion.subject}</span>
        </p>
        <a
          href={gmailThreadUrl(accountEmail, suggestion.latestThreadId)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 uppercase text-text-secondary transition-colors hover:text-text-primary"
        >
          Open in Gmail ↗
        </a>
      </div>

      {missing && (
        <p className="mt-1.5 font-sans text-[12px] normal-case tracking-normal text-accent-primary">
          Couldn't find the {missing} in this email. Open it in Gmail and fill {missing.includes(" and ") ? "them" : "it"}{" "}
          in to track.
        </p>
      )}
      {fetcher.data?.error && (
        <p className="mt-1.5 font-sans text-[12px] normal-case tracking-normal text-red-primary">{fetcher.data.error}</p>
      )}
    </li>
  );
}

function SuggestionInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const empty = !value.trim();
  return (
    <Input
      aria-label={label}
      placeholder={`Add ${label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9",
        empty && "border-accent-primary/40 placeholder:text-accent-primary/70 hover:border-accent-primary/60",
      )}
    />
  );
}
