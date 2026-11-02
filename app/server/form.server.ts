import { data } from "react-router";

export function jsonField(form: FormData, name: string, fallback: string): unknown {
  try {
    return JSON.parse(String(form.get(name) ?? fallback));
  } catch {
    throw data("Malformed form data", { status: 400 });
  }
}
