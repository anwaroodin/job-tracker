import { ApplicationSuggestions } from "~/components/applications/application-suggestions";
import type { Suggestion } from "~/types/suggestion";

export function SuggestionsBanner({
  suggestions,
  accountEmail,
  showSuggestions,
  setShowSuggestions,
}: {
  suggestions: Suggestion[];
  accountEmail: string;
  showSuggestions: boolean;
  setShowSuggestions: (update: (shown: boolean) => boolean) => void;
}) {
  return (
    <div className="border border-dashed border-accent-tertiary bg-accent-quaternary/20 px-3.5 py-2.5 text-[11px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-accent-primary">
          <span className="size-1.5 rounded-full bg-accent-primary animate-pulse" />
          <span>
            {suggestions.length} untracked {suggestions.length === 1 ? "application" : "applications"} detected in your Gmail
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowSuggestions((s) => !s)}
          className="font-mono text-text-primary transition-colors hover:text-accent-secondary cursor-pointer"
        >
          {showSuggestions ? "[Hide suggestions ▲]" : "[Review suggestions ▼]"}
        </button>
      </div>
      {showSuggestions && (
        <div className="mt-4 pt-4 border-t border-dashed border-accent-tertiary/50">
          <ApplicationSuggestions
            suggestions={suggestions}
            accountEmail={accountEmail}
          />
        </div>
      )}
    </div>
  );
}
