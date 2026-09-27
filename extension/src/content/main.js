/**
 * Content-script entry, loaded last. Starts autofill in every frame and, in
 * the top frame, the scan loop that keeps the action bar in step with the
 * job open on the page.
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT?.bar || JT.started) return;
  JT.started = true;

  JT.autofill.start();
  if (window !== window.top) return;

  // `settle` folds a burst of mutations into one pass; `ceiling` is never
  // pushed back, so pages that re-render constantly (LinkedIn) still get a
  // pass every second instead of starving a plain debounce.
  const SETTLE_MS = 200;
  const CEILING_MS = 1000;
  // A job pane renders in stages (title, apply button and description land
  // seconds apart, often after mutations stop), so a navigation starts a
  // ladder of passes rather than one timed guess.
  const RESCAN_LADDER_MS = [0, 600, 1500, 3000, 6000];

  let settleTimer = 0;
  let ceilingTimer = 0;
  let ladder = [];

  function scan() {
    clearTimeout(settleTimer);
    clearTimeout(ceilingTimer);
    settleTimer = ceilingTimer = 0;
    // A site changing its markup shouldn't surface as an uncaught rejection on its page.
    JT.bar.refresh().catch((error) => console.warn("[job-tracker] scan failed:", error));
  }

  function scheduleScan(delay = SETTLE_MS) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(scan, delay);
    ceilingTimer ||= setTimeout(scan, Math.max(delay, CEILING_MS));
  }

  function rescanWhileRendering() {
    ladder.forEach(clearTimeout);
    ladder = RESCAN_LADDER_MS.map((ms) => setTimeout(() => scheduleScan(0), ms));
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href === lastUrl) return scheduleScan();
    lastUrl = location.href;
    rescanWhileRendering();
  }).observe(document.documentElement, { childList: true, subtree: true });

  rescanWhileRendering();

  // A bookmark or status change made on the dashboard shows when you come back to the listing.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") JT.bar.recheck();
  });
})();
