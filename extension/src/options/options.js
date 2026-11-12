import { DEFAULT_ORIGIN, getDashboardOrigin, setDashboardOrigin } from "../config.js";

const saved = document.getElementById("saved");
const form = document.getElementById("dashboardForm");
const input = form.elements.namedItem("dashboard");
const error = form.querySelector("[data-error]");

input.placeholder = DEFAULT_ORIGIN;
getDashboardOrigin().then((origin) => (input.value = origin === DEFAULT_ORIGIN ? "" : origin));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const origin = await setDashboardOrigin(input.value);
  input.setAttribute("aria-invalid", String(!origin));
  error.hidden = Boolean(origin);
  if (!origin) {
    error.textContent = "Enter a dashboard address starting with https://, or leave it empty.";
    input.focus();
    return;
  }
  input.value = origin === DEFAULT_ORIGIN ? "" : origin;
  saved.hidden = false;
});
// Editing the address again hides the old confirmation.
form.addEventListener("input", () => (saved.hidden = true));
