import { NotConfiguredError, dashboardUrl, getDashboardOrigin, tailorUrl } from "../config.js";
import { AuthError, getProfile, getStats, getTailored, logApplication, lookupApplication, updateApplication } from "../lib/api.js";
import { detectCategory } from "../lib/cv.js";
import { bindDashboardForm } from "../lib/dashboard-form.js";
import { extractJob, fillForm, getActiveTab, isScriptable } from "../lib/page.js";
import { formValues } from "../lib/profile.js";
import { findTracked, forgetTracked, normaliseUrl, rememberTracked } from "../lib/tracked.js";

const $ = (id) => document.getElementById(id);

const STATUSES = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  assessment: "Assessment",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

const state = {
  /** The dashboard's origin (config.js); null until the user sets it. */
  origin: null,
  /** @type {chrome.tabs.Tab | undefined} */
  tab: undefined,
  job: { company: "", role: "", url: "", description: "" },
  /** The job's application on the dashboard: { id, status, starred }, or null while untracked. */
  application: null,
  /** @type {import("../lib/tracked.js").TrackedEntry | null} */
  tracked: null,
};

// ── View helpers ───────────────────────────────────────────────────────────

function show(view) {
  for (const el of document.querySelectorAll("[data-view]")) {
    el.hidden = el.dataset.view !== view;
  }
}

function setStatus(tone, text) {
  $("statusDot").dataset.tone = tone;
  $("statusText").textContent = text;
}

function showMessage(label, title, body) {
  $("messageLabel").textContent = label;
  $("messageTitle").textContent = title;
  $("messageBody").textContent = body;
  show("message");
}

function showResult(tone, text) {
  const el = document.querySelector("[data-view]:not([hidden]) [data-result]");
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
  el.hidden = false;
}

/** The parts of an application row the popup keeps. */
const brief = (application) => ({ id: application.id, status: application.status, starred: Boolean(application.starred) });

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const openTab = (url) => chrome.tabs.create({ url });

function signedOut() {
  setStatus("warning", "Signed out");
  $("footerCount").textContent = "";
  show("signin");
}

/** First run (or the saved address stopped being valid): ask which dashboard to use. */
function needsSetup() {
  setStatus("warning", "Not set up");
  $("footerCount").textContent = "";
  show("setup");
  $("setupForm").elements.namedItem("dashboard").focus();
}

/** Runs an action with its button disabled, routing sign-out and errors to the UI. */
async function withButton(button, busyLabel, action) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = busyLabel;
  try {
    await action();
  } catch (error) {
    if (error instanceof AuthError) signedOut();
    else if (error instanceof NotConfiguredError) needsSetup();
    else showResult("error", error?.message || "Something went wrong.");
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function render() {
  const { application } = state;
  $("statusField").hidden = !application;
  if (application) $("status").value = application.status;
  $("applyBtn").textContent = application && application.status !== "saved" ? "Fill fields" : "Apply & fill";
  $("saveBtn").hidden = Boolean(application);
  $("dashboardLink").textContent = application ? "Open application" : "Open dashboard";
  show("job");
}

// ── Actions ────────────────────────────────────────────────────────────────

/** The job's application, created with the given status (saved jobs bookmarked) when it isn't tracked yet. */
async function ensureTracked(status) {
  if (state.application) return state.application;
  const company = $("company").value.trim();
  const role = $("role").value.trim();
  $("company").setAttribute("aria-invalid", String(!company));
  $("role").setAttribute("aria-invalid", String(!role));
  if (!company || !role) throw new Error("Add the company and role first.");

  const url = normaliseUrl(state.job.url);
  const { application } = await logApplication({
    company,
    role,
    url,
    description: state.job.description,
    category: detectCategory({ role }) || undefined,
    status,
    starred: status === "saved",
  });
  state.application = brief(application);
  await rememberTracked({ url, company, role, cvType: "software", category: "", applicationId: application.id });
  render();
  refreshStats().catch(() => {});
  return state.application;
}

async function updateTracked(patch) {
  const { application } = await updateApplication(state.application.id, patch);
  state.application = brief(application);
  render();
}

async function saveJob() {
  await ensureTracked("saved");
  showResult("success", "Saved to your dashboard.");
}

async function tailor() {
  const application = await ensureTracked("saved");
  if (application.status === "saved" && !application.starred) await updateTracked({ starred: true });
  await openTab(tailorUrl(state.origin, application.id));
}

/** Tracks the job as applied (moving a saved one on) and fills the form, using its tailored summary and cover letter when it has them. */
async function applyAndFill() {
  const application = await ensureTracked("applied");
  if (application.status === "saved") await updateTracked({ status: "applied" });
  const [profile, tailored] = await Promise.all([getProfile(), getTailored(application.id).catch(() => null)]);
  const values = formValues(profile, "software");
  if (tailored?.summary) values.summary = tailored.summary;
  if (tailored?.coverLetter) values.coverLetter = tailored.coverLetter;
  const { filled } = await fillForm(state.tab.id, values);
  showResult(filled ? "success" : "info", filled ? `${plural(filled, "field")} filled.` : "No empty fields to fill on this page.");
}

async function trackAsNew() {
  if (state.tracked) await forgetTracked(state.tracked);
  state.tracked = null;
  state.application = null;
  $("company").value = state.job.company;
  $("role").value = state.job.role;
  render();
}

// ── Setup ──────────────────────────────────────────────────────────────────

async function refreshStats() {
  const stats = await getStats();
  setStatus("online", `${stats.total} tracked`);
  $("footerCount").textContent = `${stats.byStatus?.applied ?? 0} applied`;
}

/** The job's application row on the dashboard, looked up by URL or company and role, or null. */
async function findApplication() {
  state.tracked = await findTracked(state.job);
  const match = state.tracked ?? state.job;
  const { application } = await lookupApplication({ url: match.url, company: match.company, role: match.role });
  return application;
}

async function init() {
  state.origin = await getDashboardOrigin();
  if (!state.origin) return needsSetup();
  setStatus("", "Connecting");

  try {
    await refreshStats();
  } catch (error) {
    if (error instanceof AuthError) return signedOut();
    if (error instanceof NotConfiguredError) return needsSetup();
    setStatus("offline", "Offline");
    return showMessage("Status", "Can't reach the dashboard", "Check your connection and reopen the popup.");
  }

  state.tab = await getActiveTab();
  if (!isScriptable(state.tab)) {
    return showMessage("Page", "Open a job page", "Open a job posting or application form, then click the extension again.");
  }

  try {
    state.job = await extractJob(state.tab.id);
  } catch (error) {
    return showMessage("Page", "Can't read this page", error?.message || "Chrome doesn't allow extensions on this page.");
  }

  const found = await findApplication().catch(() => null);
  state.application = found && brief(found);
  $("company").value = found?.company || state.job.company;
  $("role").value = found?.role || state.job.role;
  render();
}

$("status").replaceChildren(...Object.entries(STATUSES).map(([value, label]) => new Option(label, value)));
for (const button of document.querySelectorAll('[data-action="dashboard"]')) {
  button.addEventListener("click", () => (state.origin ? openTab(dashboardUrl(state.origin, state.application?.id)) : needsSetup()));
}
for (const button of document.querySelectorAll('[data-action="options"]')) {
  button.addEventListener("click", () => chrome.runtime.openOptionsPage());
}
// Saving the address carries on into the popup's normal start.
bindDashboardForm($("setupForm"), { onSaved: () => init() });
$("jobForm").addEventListener("submit", (event) => {
  event.preventDefault();
  withButton($("applyBtn"), "Filling…", applyAndFill);
});
$("saveBtn").addEventListener("click", () => withButton($("saveBtn"), "Saving…", saveJob));
$("tailorBtn").addEventListener("click", () => withButton($("tailorBtn"), "Opening…", tailor));
$("status").addEventListener("change", (event) => {
  const select = event.target;
  select.disabled = true;
  updateTracked({ status: select.value })
    .then(() => showResult("success", `Marked as ${STATUSES[select.value].toLowerCase()}.`))
    .catch((error) => (error instanceof AuthError ? signedOut() : showResult("error", error?.message || "Couldn't update the status.")))
    .finally(() => (select.disabled = false));
});
$("newApplicationBtn").addEventListener("click", trackAsNew);

init();
