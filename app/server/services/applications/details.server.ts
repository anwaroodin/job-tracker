import type { EditableDetails } from "~/types/application";
import { cleanUrl, text } from "../../extension/input.server";

/** The details form, validated; null when company or role is missing. Empty fields clear the column. */
export function detailsFromForm(form: FormData): EditableDetails | null {
  const field = (name: string, max: number) => text(form.get(name), max);
  const details = {
    company: field("company", 200),
    role: field("role", 200),
    url: cleanUrl(form.get("url")),
    location: field("location", 200),
    workType: field("workType", 50),
    employmentType: field("employmentType", 50),
    salary: field("salary", 100),
    notes: field("notes", 5_000),
    description: field("description", 20_000),
  };
  return details.company && details.role ? details : null;
}
