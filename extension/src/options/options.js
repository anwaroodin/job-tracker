import { bindDashboardForm } from "../lib/dashboard-form.js";

const saved = document.getElementById("saved");
const form = document.getElementById("dashboardForm");

bindDashboardForm(form, { onSaved: () => (saved.hidden = false) });
// Editing the address again hides the old confirmation.
form.addEventListener("input", () => (saved.hidden = true));
