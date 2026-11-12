import { cn } from "~/lib/cn";
import type { Contact } from "~/lib/contacts";

/** LinkedIn's reasons that mean the person owns the hire, worth flagging. */
const HIRING = /job poster|hiring team|recruit/i;

/** A headline without emoji, with its separators ("| ", "·", "•") made consistent. */
function cleanHeadline(raw: string) {
  return raw
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s*[•·|]\s*/g, " • ")
    .replace(/^[•·|\s-]+|[•·|\s-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** LinkedIn's reason for the suggestion, shortened: "School alum from X" → "Alum · X". */
function formatNote(note: string) {
  return note
    .replace(/^School alum from\s+/i, "Alum · ")
    .replace(/^Past company alum from\s+/i, "Alum · ")
    .trim();
}

/**
 * People the listing suggests reaching out to. Each row opens their LinkedIn
 * profile and inverts on hover, like the other rows on the Applications pages.
 */
export function ContactList({ contacts, className }: { contacts: Contact[]; className?: string }) {
  return (
    <ul className={cn("divide-y divide-stroke-primary border-y border-stroke-secondary", className)}>
      {contacts.map((contact) => {
        const hiring = HIRING.test(contact.note);
        // Names arrive cleaned by cleanContacts (app/lib/contacts.ts).
        const name = contact.name;
        const headline = cleanHeadline(contact.headline);
        const note = formatNote(contact.note);
        const hiringLabel = contact.note.replace(/\s*[•·].*$/, "").trim();

        return (
          <li key={contact.profileUrl}>
            <a
              href={contact.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 px-1.5 py-2.5 transition-colors hover:bg-text-primary focus-visible:bg-text-primary focus-visible:outline-none"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="min-w-0 truncate font-sans text-[13.5px] font-medium text-text-primary group-focus-visible:!text-text-inverse"
                  title={name}
                >
                  {name}
                </span>
                <span className="shrink-0 flex items-baseline gap-1.5 text-[12.5px] text-text-tertiary">
                  {contact.degree && <span>{contact.degree}</span>}
                  <span aria-hidden>Profile ↗</span>
                </span>
              </div>

              {headline && (
                <p
                  className="truncate font-sans text-[12px] text-text-secondary "
                  title={contact.headline}
                >
                  {headline}
                </p>
              )}

              {contact.note && (
                <div className="flex items-center min-w-0">
                  {hiring ? (
                    <span className="text-[12.5px] font-medium text-accent-primary">
                      {hiringLabel}
                    </span>
                  ) : (
                    <span
                      className="truncate font-sans text-[12.5px] text-text-tertiary "
                      title={contact.note}
                    >
                      {note}
                    </span>
                  )}
                </div>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
