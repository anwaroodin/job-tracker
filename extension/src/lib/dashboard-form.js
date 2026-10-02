/**
 * The "dashboard address" form, shared by the popup's first-run view and the
 * options page. Expects a <form> holding an input named "dashboard" and an
 * element with [data-error] for validation messages.
 */
import { getDashboardOrigin, setDashboardOrigin } from "../config.js";

/**
 * Fills the form with the saved address and saves a valid one on submit.
 * @param {HTMLFormElement} form
 * @param {{ onSaved?: (origin: string) => void }} [options]
 */
export async function bindDashboardForm(form, { onSaved } = {}) {
  const input = form.elements.namedItem("dashboard");
  const error = form.querySelector("[data-error]");
  input.value = (await getDashboardOrigin()) ?? "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const origin = await setDashboardOrigin(input.value);
    input.setAttribute("aria-invalid", String(!origin));
    error.hidden = Boolean(origin);
    if (!origin) {
      error.textContent = "Enter your dashboard's address, starting with https://.";
      input.focus();
      return;
    }
    input.value = origin;
    onSaved?.(origin);
  });
}
