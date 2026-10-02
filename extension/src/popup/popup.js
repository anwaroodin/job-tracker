import { NotConfiguredError, dashboardUrl, getDashboardOrigin } from "../config.js";
import { AuthError, getProfile, getStats, logApplication } from "../lib/api.js";
import { detectCategory, detectCvType } from "../lib/cv.js";
import { bindDashboardForm } from "../lib/dashboard-form.js";
import { extractJob, fillForm, getActiveTab, isScriptable } from "../lib/page.js";
import { formValues } from "../lib/profile.js";
import { findTracked, forgetTracked, normaliseUrl, rememberTracked } from "../lib/tracked.js";

const $ = (id) => document.getElementById(id);

const state = {
  /** The dashboard's origin (config.js); null until the user sets it. */
  origin: null,
  /** @type {chrome.tabs.Tab | undefined} */
  tab: undefined,
  job: { company: "", role: "", url: "", description: "" },
  cvType: "software",
  category: "",
  /** @type {import("../lib/tracked.js").TrackedEntry | null} */
  tracked: null,
};

const CV_LABELS = { software: "Software CV", retail: "Retail / general CV" };
const CATEGORY_LABELS = { grad: "Grad", intern: "Intern", junior: "Junior" };

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

/** Shows a result banner in the visible view, with an optional link to the tracked application. */
function showResult(tone, text, applicationId) {
  const el = document.querySelector("[data-view]:not([hidden]) [data-result]");
  if (!el) return;
  el.replaceChildren(text);
  if (applicationId) {
    const link = document.createElement("button");
    link.type = "button";
    link.className = "link";
    link.textContent = "View";
    link.addEventListener("click", () => openTab(dashboardUrl(state.origin, applicationId)));
    el.append(link);
  }
  el.dataset.tone = tone;
  el.hidden = false;
}

function setSegment(control, value) {
  for (const btn of document.querySelectorAll(`[data-control="${control}"] .seg-btn`)) {
    btn.setAttribute("aria-pressed", String(btn.dataset.value === value));
  }
  state[control] = value;
}

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

async function fillPage(cvType) {
  const profile = await getProfile();
  const { filled } = await fillForm(state.tab.id, formValues(profile, cvType));
  return filled;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function fillAndTrack() {
  const company = $("company").value.trim();
  const role = $("role").value.trim();
  $("company").setAttribute("aria-invalid", String(!company));
  $("role").setAttribute("aria-invalid", String(!role));
  if (!company || !role) {
    showResult("error", "Add the company and role before tracking.");
    ($("company").value.trim() ? $("role") : $("company")).focus();
    return;
  }

  const filled = await fillPage(state.cvType);
  const url = normaliseUrl(state.job.url);
  const { duplicate, application } = await logApplication({
    company,
    role,
    url,
    description: state.job.description,
    cv_type: state.cvType,
    category: state.category || undefined,
    status: "applied",
    auto_filled: true,
  });

  await rememberTracked({
    url,
    company,
    role,
    cvType: state.cvType,
    category: state.category,
    applicationId: application.id,
  });

  const summary = `${plural(filled, "field")} filled.`;
  showResult(
    "success",
    duplicate ? `${summary} Already on your dashboard.` : `${summary} Tracked.`,
    application.id,
  );
  refreshStats().catch(() => {});
}

async function fillOnly() {
  const filled = await fillPage(state.tracked.cvType);
  if (filled === 0) showResult("info", "No empty fields to fill on this page.");
  else showResult("success", `${plural(filled, "field")} filled.`, state.tracked.applicationId);
}

async function trackAsNew() {
  await forgetTracked(state.tracked);
  state.tracked = null;
  showTrackForm();
}

// ── Setup ──────────────────────────────────────────────────────────────────

function showTrackForm() {
  const { job } = state;
  $("company").value = job.company;
  $("role").value = job.role;
  setSegment("cvType", detectCvType(job));
  setSegment("category", detectCategory(job));
  show("track");
}

function showTracked(entry) {
  $("trackedCompany").textContent = entry.company;
  $("trackedRole").textContent = entry.role;
  const category = CATEGORY_LABELS[entry.category];
  $("trackedCv").textContent = [CV_LABELS[entry.cvType] ?? entry.cvType, category].filter(Boolean).join(" · ");
  show("continue");
}

async function refreshStats() {
  const stats = await getStats();
  setStatus("online", `${stats.total} tracked`);
  $("footerCount").textContent = `${stats.byStatus?.applied ?? 0} applied`;
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

  state.tracked = await findTracked(state.job);
  if (state.tracked) showTracked(state.tracked);
  else showTrackForm();
}

for (const control of document.querySelectorAll("[data-control]")) {
  control.addEventListener("click", (event) => {
    const button = event.target.closest(".seg-btn");
    if (button) setSegment(control.dataset.control, button.dataset.value);
  });
}
for (const button of document.querySelectorAll('[data-action="dashboard"]')) {
  button.addEventListener("click", () => (state.origin ? openTab(dashboardUrl(state.origin)) : needsSetup()));
}
for (const button of document.querySelectorAll('[data-action="options"]')) {
  button.addEventListener("click", () => chrome.runtime.openOptionsPage());
}
// Saving the address carries on into the popup's normal start.
bindDashboardForm($("setupForm"), { onSaved: () => init() });
$("trackForm").addEventListener("submit", (event) => {
  event.preventDefault();
  withButton($("trackBtn"), "Filling…", fillAndTrack);
});
$("fillBtn").addEventListener("click", () => withButton($("fillBtn"), "Filling…", fillOnly));
$("newApplicationBtn").addEventListener("click", trackAsNew);

init();
