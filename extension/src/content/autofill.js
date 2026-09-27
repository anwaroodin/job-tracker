/**
 * Autofill for tabs the service worker marks as pending (the user clicked
 * Apply & fill). Runs in every frame: fills recognised fields as they
 * appear, across the steps of multi-page forms, until the user stops it or
 * the pending state expires. The top frame shows progress in a bar at the
 * top right of the page.
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.autofill) return;
  const { h, shadowHost, send } = JT.ui;

  const isTop = window === window.top;
  /** Subframes are only filled when they hold a real form, not an ad or a newsletter box. */
  const MIN_FRAME_FIELDS = 3;
  const FILL_DEBOUNCE_MS = 600;

  const state = {
    active: false,
    values: null,
    /** Set when this tab is the listing the user applied from, rather than the application tab. */
    sourceUrl: null,
    company: "",
    role: "",
    filled: 0,
    /** A notice shown in the bar when nothing is being filled (e.g. signed out). */
    notice: "",
    timer: 0,
    observer: null,
  };

  // ── Status bar (top frame) ─────────────────────────────────────────────────

  let bar = null;

  /** A listing that opened its form elsewhere only shows the bar once it fills something itself. */
  const barVisible = () => state.active && (!state.sourceUrl || state.filled > 0);

  function render() {
    if (!isTop) return;
    if (!barVisible() && !state.notice) {
      bar?.host.remove();
      return;
    }
    if (!bar) {
      bar = shadowHost("job-tracker-autofill");
      bar.root.className = "corner top";
    }
    if (!bar.host.isConnected) document.documentElement.append(bar.host);

    const job = [state.role, state.company].filter(Boolean).join(" · ");
    bar.root.replaceChildren(
      barVisible()
        ? h("div", { class: "strip fill-bar", role: "status" },
            h("span", { class: "title" }, h("span", { class: "dot on" }), "Autofilling"),
            h("span", { class: "job", title: job }, job),
            h("span", { class: "count" }, `${state.filled} field${state.filled === 1 ? "" : "s"}`),
            h("button", { type: "button", onclick: (event) => event.isTrusted && stop() }, "Stop"))
        : h("div", { class: "strip fill-bar", role: "status" },
            h("span", { class: "title" }, h("span", { class: "dot" }), "job-tracker"),
            h("span", { class: "job" }, state.notice),
            h("button", { type: "button", "aria-label": "Dismiss", onclick: () => notify("") }, "×")),
    );
  }

  function notify(text) {
    state.notice = text;
    render();
  }

  function addFilled(count) {
    state.filled += count;
    render();
  }

  // ── Filling ────────────────────────────────────────────────────────────────

  function stop({ tellWorker = true } = {}) {
    state.active = false;
    state.values = null;
    state.observer?.disconnect();
    clearTimeout(state.timer);
    if (tellWorker) send({ type: "fill:stop" });
    render();
  }

  function fillNow() {
    if (!state.active) return;
    if (isTop && state.sourceUrl) {
      // The listing tab stays pending for in-page apply dialogs; moving to another job ends that.
      const job = JT.readJob();
      if (job && job.url !== state.sourceUrl) return stop();
    } else if (!isTop && JT.countFields() < MIN_FRAME_FIELDS) {
      return;
    }
    // On the listing itself only an apply dialog (LinkedIn Easy Apply) is
    // filled, never the site's own search and filter boxes.
    const { filled } = JT.fillForm(state.values, { dialogOnly: isTop && Boolean(state.sourceUrl) });
    if (!filled) return;
    if (isTop) addFilled(filled);
    else send({ type: "fill:progress", filled });
  }

  function scheduleFill() {
    clearTimeout(state.timer);
    state.timer = setTimeout(fillNow, FILL_DEBOUNCE_MS);
  }

  /** Asks the service worker whether this tab is being applied to, and starts filling if so. */
  async function start() {
    // Checked first so ordinary page loads don't wake the service worker.
    const { hasPending } = await chrome.storage.local.get("hasPending");
    if (!hasPending) return;

    const res = await send({ type: "fill:get" });
    if (res?.error === "signed_out") return notify("Sign in to job-tracker to autofill this form.");
    if (!res?.values) return;

    Object.assign(state, { active: true, values: res.values, sourceUrl: res.sourceUrl, company: res.company, role: res.role });
    state.observer?.disconnect();
    state.observer = new MutationObserver(scheduleFill);
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    render();
    fillNow();
  }

  // Fill counts from this tab's iframes, relayed by the service worker.
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isTop || sender.id !== chrome.runtime.id) return;
    if (message?.type === "fill:progress" && Number.isInteger(message.filled)) addFilled(message.filled);
  });

  JT.autofill = { start, MIN_FRAME_FIELDS };
})();
