/**
 * Runs the page script in the active tab for the popup. The script is
 * normally already there as a content script; injecting it covers tabs that
 * were open before the extension was installed or reloaded.
 */

/**
 * The content-script library, in manifest order. The in-page UI (ui.js,
 * autofill.js, bar.js, main.js) is left out: the popup only reads and fills.
 */
const PAGE_SCRIPTS = [
  "src/content/core.js",
  "src/content/adapters/linkedin.js",
  "src/content/adapters/indeed.js",
  "src/content/adapters/google.js",
  "src/content/capture.js",
  "src/content/fill.js",
];

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Only regular web pages can be scripted (not chrome://, the Web Store, etc). */
export function isScriptable(tab) {
  return Boolean(tab?.id && tab.url && /^https?:/.test(tab.url));
}

/**
 * Calls a function exported by the page script. The script is injected on
 * first use and reused afterwards (it guards against double registration).
 */
async function run(tabId, method, arg) {
  const target = { tabId };
  await chrome.scripting.executeScript({ target, files: PAGE_SCRIPTS });
  const [result] = await chrome.scripting.executeScript({
    target,
    func: (name, value) => globalThis.__jobTracker[name](value),
    // `undefined` isn't serialisable and makes executeScript reject.
    args: [method, arg ?? null],
  });
  return result?.result;
}

/** @returns {Promise<{ company: string, role: string, url: string, description: string }>} */
export const extractJob = (tabId) => run(tabId, "extractJob");

/** @returns {Promise<{ filled: number }>} */
export const fillForm = (tabId, values) => run(tabId, "fillForm", values);
