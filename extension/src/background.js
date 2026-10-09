/**
 * Service worker: the only part of the extension that talks to the
 * dashboard API, and the owner of autofill state.
 *
 * A tab becomes "pending" when the user clicks Apply & fill. The tab the
 * application opens in inherits it: a tab we open for an apply link, the
 * first foreground tab the site opens from its own apply button, or the same
 * tab for in-page forms such as LinkedIn Easy Apply. Pending state lives in
 * session storage (cleared when the browser closes) and never holds profile
 * data; the profile is fetched when a frame asks for values to fill.
 *
 * Messages (from content scripts only):
 *   job:check    { job }                        → { application, cvType, category }
 *   job:save     { record }                     → { application }
 *   job:update   { applicationId, patch }       → { application }
 *   job:apply    { record, applicationId?, keepStatus, open, applyUrl? } → { application }
 *   fill:get     {}                             → { values, company, role, sourceUrl } | null
 *                (values use the application's tailored summary and cover letter when it has them)
 *   fill:stop    {}
 *   fill:progress { filled }                    (relayed to the tab's top frame)
 *   open         { page: "dashboard" | "application" | "tailor" | "options", applicationId? }
 * Failures resolve to { error }: "signed_out" when the session is gone,
 * "not_configured" while no dashboard address is set (see config.js).
 */
import { NotConfiguredError, dashboardUrl, getDashboardOrigin, tailorUrl } from "./config.js";
import { AuthError, getProfile, getTailored, logApplication, lookupApplication, updateApplication } from "./lib/api.js";
import { detectCategory, detectCvType } from "./lib/cv.js";
import { formValues } from "./lib/profile.js";
import { findTracked, normaliseUrl, rememberTracked } from "./lib/tracked.js";

const APPLY_TAB_MS = 2 * 60 * 60 * 1000;
/** How long the listing tab keeps filling in-page apply dialogs. */
const SOURCE_TAB_MS = 15 * 60 * 1000;
/** A tab the listing opens within this window after Apply is the application. */
const ARMED_MS = 30 * 1000;
/** A tab opened this recently, before the listing was armed, still counts. */
const EARLY_CHILD_MS = 5 * 1000;
const PROFILE_CACHE_MS = 60 * 1000;

const contactCount = (json) => {
  try {
    return JSON.parse(json || "[]").length;
  } catch {
    return 0;
  }
};

/** The subset of an application row the action bar needs. */
const summary = ({ id, status, starred, cvType, category, description, contactsJson }) => ({
  id,
  status,
  starred: Boolean(starred),
  cvType,
  category: category ?? "",
  // Let the bar tell when the page shows more than was saved, so it can backfill.
  descriptionLength: description?.length ?? 0,
  contactCount: contactCount(contactsJson),
});

// ── Pending tabs ─────────────────────────────────────────────────────────────

/**
 * @typedef {{ attempt: string, company: string, role: string, cvType: string,
 *   fillHere: boolean, expiresAt: number, sourceUrl?: string, armedUntil?: number,
 *   tailored?: { summary: string | null, coverLetter: string | null } }} Pending
 */

let queue = Promise.resolve();

/** Serialises read-modify-write of pending state so tab events and messages can't interleave. */
function withPending(fn) {
  const run = queue.then(async () => {
    const { pending = {} } = await chrome.storage.session.get("pending");
    const now = Date.now();
    for (const [id, entry] of Object.entries(pending)) if (entry.expiresAt < now) delete pending[id];
    const result = await fn(pending, now);
    await chrome.storage.session.set({ pending });
    // Content scripts check this before messaging, so ordinary page loads don't wake the worker.
    await chrome.storage.local.set({ hasPending: Object.keys(pending).length > 0 });
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

/**
 * Marks a tab opened from an armed listing as the application tab. Only the
 * first tab counts, so other jobs opened from the listing aren't filled.
 */
function adopt(pending, tabId, parent, now) {
  const { attempt, company, role, cvType, tailored } = parent;
  pending[tabId] = { attempt, company, role, cvType, tailored, fillHere: true, expiresAt: now + APPLY_TAB_MS };
  parent.armedUntil = 0;
}

/** Foreground tabs opened recently, in case one appears before its opener is armed. */
const recentTabs = [];

chrome.tabs.onCreated.addListener((tab) => {
  // Apply buttons open a foreground tab; links the user middle-clicks open in the background.
  if (tab.openerTabId === undefined || !tab.active) return;
  recentTabs.push({ id: tab.id, opener: tab.openerTabId, at: Date.now() });
  recentTabs.splice(0, recentTabs.length - 20);
  withPending((pending, now) => {
    const parent = pending[tab.openerTabId];
    if (parent && (parent.armedUntil ?? 0) > now) adopt(pending, tab.id, parent, now);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  withPending((pending) => {
    delete pending[tabId];
  });
});

// Session storage is cleared on browser restart; clear the flag to match.
chrome.runtime.onStartup.addListener(() => chrome.storage.local.set({ hasPending: false }));

// ── Profile ──────────────────────────────────────────────────────────────────

let profileCache = { at: 0, profile: null };

async function profile() {
  if (Date.now() - profileCache.at > PROFILE_CACHE_MS) {
    profileCache = { at: Date.now(), profile: await getProfile() };
  }
  return profileCache.profile;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/** The dashboard's application for a listing, plus suggested CV settings. */
async function checkJob({ job }) {
  const suggested = { cvType: detectCvType(job), category: detectCategory(job) };
  try {
    const { application } = await lookupApplication({ ...job, url: normaliseUrl(job.url) });
    return { ...suggested, application: application && summary(application) };
  } catch (error) {
    if (error instanceof AuthError || error instanceof NotConfiguredError) throw error;
    // Offline: fall back to what this device tracked. A listing is its own
    // job, so another job on the same site doesn't count.
    const local = await findTracked(job, { sameHost: false });
    const application = local && {
      id: local.applicationId,
      status: local.status ?? "applied",
      starred: false,
      // Unknown offline; claim it's complete so the bar doesn't try to backfill.
      // (Not Infinity: extension messages are JSON, which turns it into null.)
      descriptionLength: Number.MAX_SAFE_INTEGER,
      contactCount: Number.MAX_SAFE_INTEGER,
    };
    return { ...suggested, application };
  }
}

/** Creates the application (the server returns the existing one for the same posting). */
async function saveJob({ record }) {
  const { application } = await logApplication({ ...record, url: normaliseUrl(record.url) });
  await rememberTracked({
    url: record.url,
    company: record.company,
    role: record.role,
    cvType: record.cv_type,
    category: record.category ?? "",
    status: application.status,
    applicationId: application.id,
  });
  return { application: summary(application) };
}

/** Status, star and detail changes to a tracked application. */
async function updateJob({ applicationId, patch }) {
  const { application } = await updateApplication(applicationId, patch);
  return { application: summary(application) };
}

/**
 * Starts an application from a listing: arms the tab for autofill, records
 * the application and opens the apply link when there is one.
 */
async function applyToJob({ record, applicationId, keepStatus, open, applyUrl }, tab) {
  const attempt = crypto.randomUUID();
  const autofill = open !== "none";

  // Arm before the network call: the site may open its application tab
  // while the request is in flight.
  if (autofill) {
    await withPending((pending, now) => {
      const source = {
        attempt,
        company: record.company,
        role: record.role,
        cvType: record.cv_type,
        sourceUrl: record.url,
        // A link opens in a tab we create; the listing itself only fills
        // forms that open in place (dialogs, same-tab navigation).
        fillHere: open !== "link",
        armedUntil: now + ARMED_MS,
        expiresAt: now + SOURCE_TAB_MS,
      };
      pending[tab.id] = source;
      const early = recentTabs.find((t) => t.opener === tab.id && now - t.at < EARLY_CHILD_MS);
      if (early) adopt(pending, early.id, source, now);
    });
  }

  let application;
  try {
    // A job already tracked from the bar is updated, never posted again.
    // Refilling a job past "saved" keeps its status.
    ({ application } = applicationId
      ? await updateJob({ applicationId, patch: keepStatus ? record : { ...record, status: "applied" } })
      : await saveJob({ record: { ...record, status: "applied", auto_filled: autofill } }));
  } catch (error) {
    await withPending((pending) => {
      for (const [id, entry] of Object.entries(pending)) if (entry.attempt === attempt) delete pending[id];
    });
    throw error;
  }

  if (autofill) {
    const tailored = await getTailored(application.id).catch(() => null);
    if (tailored?.coverLetter || tailored?.summary) {
      await withPending((pending) => {
        for (const entry of Object.values(pending)) if (entry.attempt === attempt) entry.tailored = tailored;
      });
    }
  }

  if (open === "link" && /^https?:\/\//.test(applyUrl ?? "")) {
    const opened = await chrome.tabs.create({ url: applyUrl, openerTabId: tab.id, index: tab.index + 1 });
    await withPending((pending, now) => {
      if (pending[tab.id]) adopt(pending, opened.id, pending[tab.id], now);
    });
  }
  return { application };
}

/** Values to fill for a frame whose tab is pending, or null. */
async function fillValues(_message, tab) {
  await queue;
  const { pending = {} } = await chrome.storage.session.get("pending");
  const entry = pending[tab.id];
  if (!entry?.fillHere || entry.expiresAt < Date.now()) return null;
  const values = formValues(await profile(), entry.cvType);
  if (entry.tailored?.summary) values.summary = entry.tailored.summary;
  if (entry.tailored?.coverLetter) values.coverLetter = entry.tailored.coverLetter;
  return {
    values,
    company: entry.company,
    role: entry.role,
    sourceUrl: entry.sourceUrl ?? null,
  };
}

async function stopFill(_message, tab) {
  await withPending((pending) => {
    delete pending[tab.id];
  });
  return {};
}

async function relayProgress({ filled }, tab) {
  if (Number.isInteger(filled) && filled > 0) {
    await chrome.tabs.sendMessage(tab.id, { type: "fill:progress", filled }, { frameId: 0 }).catch(() => {});
  }
  return {};
}

/** Opens the dashboard (or one application on it), or the options page while no dashboard is set. */
async function openPage({ page, applicationId }, tab) {
  const origin = await getDashboardOrigin();
  if (!origin || page === "options") {
    await chrome.runtime.openOptionsPage();
    return {};
  }
  const id = (page === "application" || page === "tailor") && /^[\w-]+$/.test(applicationId ?? "") ? applicationId : undefined;
  const url = page === "tailor" && id ? tailorUrl(origin, id) : dashboardUrl(origin, id);
  await chrome.tabs.create({ url, openerTabId: tab.id, index: tab.index + 1 });
  return {};
}

/** The error code a content script gets back for a failed request. */
function errorCode(error) {
  if (error instanceof AuthError) return "signed_out";
  if (error instanceof NotConfiguredError) return "not_configured";
  return error.message;
}

const HANDLERS = {
  "job:check": checkJob,
  "job:save": saveJob,
  "job:update": updateJob,
  "job:apply": applyToJob,
  "fill:get": fillValues,
  "fill:stop": stopFill,
  "fill:progress": relayProgress,
  open: openPage,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = HANDLERS[message?.type];
  // Only our own content scripts, in a tab, may call these.
  if (!handler || sender.id !== chrome.runtime.id || !sender.tab?.id) return false;
  handler(message, sender.tab)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: errorCode(error) }));
  return true;
});
