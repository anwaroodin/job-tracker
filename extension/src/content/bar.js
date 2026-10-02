/**
 * The action bar shown on job listings (top frame only):
 *
 *   [● status ▾] [bookmark/★] [↗] [⧉] [▾] [Apply & fill]
 *
 * Mounted where the site adapter says (LinkedIn: the right end of the
 * Easy Apply / Save row), or floating bottom-right on sites without an
 * anchor. ▾ opens a quick view to correct the role and company, pick the CV
 * and category, and see the facts read from the page.
 *
 * The bar also keeps the dashboard's copy of the job complete: details that
 * render after the job is saved (the description, the people to reach out
 * to) are sent over as they appear; see backfill().
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.bar) return;
  const { h, icon, shadowHost, send } = JT.ui;

  const STATUSES = {
    saved: { label: "Saved", color: "#6e6f76" },
    applied: { label: "Applied", color: "#d4d4d8" },
    screening: { label: "Screening", color: "#a6a7ad" },
    interview: { label: "Interview", color: "#e8b33c" },
    assessment: { label: "Assessment", color: "#f0cf85" },
    offer: { label: "Offer", color: "#58b68a" },
    accepted: { label: "Accepted", color: "#8fd0ae" },
    rejected: { label: "Rejected", color: "#d1707a" },
    ghosted: { label: "Ghosted", color: "#6e6f76" },
    withdrawn: { label: "Withdrawn", color: "#4a4c53" },
  };
  const CV_OPTIONS = [["software", "Software"], ["retail", "Retail"]];
  const CATEGORY_OPTIONS = [["", "—"], ["grad", "Grad"], ["intern", "Intern"], ["junior", "Junior"]];
  const COPIED_MS = 1500;

  const state = {
    /** The job read from the page: { company, role, url, description }. */
    job: null,
    /** The user's corrections to role and company in the quick view. */
    edits: { company: null, role: null },
    cvType: "software",
    category: "",
    /**
     * The tracked application (background.js summary()): { id, status, starred,
     * cvType, category, descriptionLength, contactCount }, or null when untracked.
     */
    app: null,
    /** An action is in flight; the bar's controls are disabled meanwhile. */
    busy: false,
    /** Apply & fill is running; the only action that relabels its button. */
    applying: false,
    copied: false,
    open: false,
    /** { tone: "success" | "error", text, action?: { label, page }, at: shown-at timestamp } */
    message: null,
    /** A job the user hid the floating bar for. */
    hiddenUrl: null,
  };

  // ── The job record sent to the dashboard ───────────────────────────────────

  /** Re-reads the page so a description LinkedIn rendered late (on scroll) is saved in full. */
  function refreshDescription() {
    const fresh = JT.readJob();
    if (fresh?.url === state.job.url && fresh.description.length > state.job.description.length) {
      state.job.description = fresh.description;
    }
  }

  /** The listing's description, header facts and people to reach out to, in the API's field names. */
  function details(contacts = JT.readContacts()) {
    refreshDescription();
    const facts = Object.fromEntries(JT.quickFacts(state.job).map((fact) => [fact.key, fact.text]));
    return {
      description: state.job.description,
      location: facts.location,
      work_type: facts.workType,
      salary: facts.salary,
      employment_type: facts.employment,
      posted_at: JT.postedDate(facts.posted),
      applicants: facts.applicants,
      contacts: contacts.length ? contacts : undefined,
    };
  }

  /** Everything saved with the application, in the API's field names. */
  function record() {
    return {
      company: (state.edits.company ?? state.job.company).trim(),
      role: (state.edits.role ?? state.job.role).trim(),
      url: state.job.url,
      ...details(),
      cv_type: state.cvType,
      category: state.category || undefined,
    };
  }

  /**
   * Sites like LinkedIn render the description and the people section seconds
   * after the job opens (the people only once scrolled to), so a job saved
   * before then is missing them. Once the page shows more description or more
   * people than the dashboard has, send the details over.
   * Runs from the scan loop; one request at a time, never during an action.
   */
  let backfilling = false;
  async function backfill() {
    const app = state.app;
    if (!app || backfilling || state.busy) return;
    const contacts = JT.readContacts();
    const moreText = state.job.description.length > (app.descriptionLength ?? 0);
    const morePeople = contacts.length > (app.contactCount ?? 0);
    if (!moreText && !morePeople) return;
    backfilling = true;
    const patch = details(contacts);
    try {
      const res = await send({ type: "job:update", applicationId: app.id, patch });
      if (state.app?.id !== app.id) return; // the bar moved on to another application
      // Only the saved lengths are taken from the answer: a status or bookmark
      // change made meanwhile has its own, newer answer. They never go below
      // what was sent, so the same details are never sent twice (even if the
      // request failed or the server trimmed them).
      state.app.descriptionLength = Math.max(res.application?.descriptionLength ?? 0, patch.description.length);
      state.app.contactCount = Math.max(res.application?.contactCount ?? 0, contacts.length);
    } finally {
      backfilling = false;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Confirmations clear themselves after this long; errors stay until dismissed. */
  const SUCCESS_MS = 4000;
  let messageTimer = 0;

  function setMessage(tone, text, action) {
    clearTimeout(messageTimer);
    state.message = text ? { tone, text, action, at: Date.now() } : null;
    if (text && tone === "success") {
      const shown = state.message;
      messageTimer = setTimeout(() => {
        if (state.message === shown) setMessage();
      }, SUCCESS_MS);
    }
    render();
  }

  /** Shows a failed response; returns true when there was one. */
  function failed(res) {
    if (!res?.error) return false;
    if (res.error === "signed_out") {
      setMessage("error", "Sign in to job-tracker to save jobs.", { label: "Sign in", page: "dashboard" });
    } else if (res.error === "not_configured") {
      setMessage("error", "Set your dashboard address to save jobs.", { label: "Set up", page: "options" });
    } else {
      setMessage("error", res.error);
    }
    return true;
  }

  /** Company and role are required; opens the quick view to fix them when missing. */
  function validRecord() {
    const data = record();
    if (data.company && data.role) return data;
    state.open = true;
    setMessage("error", "Add the company and role first.");
    return null;
  }

  /** Runs an action with the bar disabled, so double clicks can't save twice. */
  async function busy(action) {
    if (state.busy) return;
    state.busy = true;
    render();
    try {
      await action();
    } finally {
      state.busy = false;
      render();
    }
  }

  /** Saves the job with the given status/star, creating the application when untracked. */
  async function save(changes, successText) {
    const data = validRecord();
    if (!data) return;
    const res = state.app
      ? await send({ type: "job:update", applicationId: state.app.id, patch: { ...data, ...changes } })
      : await send({ type: "job:save", record: { ...data, ...changes } });
    if (state.job?.url !== data.url) return; // the user moved to another job meanwhile
    if (failed(res)) return;
    setApp(res.application);
    if (successText) setMessage("success", successText);
  }

  const setStatus = (status) =>
    busy(() => save({ status }, state.app ? null : `Saved as ${STATUSES[status].label.toLowerCase()}.`));

  // The `starred` flag: a bookmark on a saved job, a star once applied.
  const toggleFlag = () =>
    busy(() =>
      state.app
        ? save({ starred: !state.app.starred })
        : save({ status: "saved", starred: true }, "Saved and bookmarked."),
    );

  function openDashboard() {
    send({ type: "open", page: state.app ? "application" : "dashboard", applicationId: state.app?.id });
  }

  async function copyDescription() {
    const data = record();
    const text = [`${data.role} — ${data.company}`, data.url, "", data.description].join("\n").trim();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setMessage("error", "Couldn't copy: the page blocked clipboard access.");
      return;
    }
    state.copied = true;
    render();
    setTimeout(() => {
      state.copied = false;
      render();
    }, COPIED_MS);
  }

  /**
   * Tracks the job as applied, then opens or clicks the site's apply control
   * and autofills the form. On a job already past "saved" it only refills,
   * keeping the status (an interview stays an interview).
   */
  async function applyAndFill(event) {
    if (!event.isTrusted || state.busy) return;
    const data = validRecord();
    if (!data) return;

    const target = JT.findApplyTarget();
    let open = "none";
    if (target?.kind === "link") open = "link";
    else if (target?.kind === "click") open = "click";
    else if (JT.countFields() >= JT.autofill.MIN_FRAME_FIELDS) open = "form";

    state.busy = state.applying = true;
    render();
    const pending = send({
      type: "job:apply",
      record: data,
      applicationId: state.app?.id,
      keepStatus: Boolean(state.app && state.app.status !== "saved"),
      open,
      applyUrl: target?.kind === "link" ? target.href : undefined,
    });
    // Click the site's own button inside this user gesture so any tab it opens isn't blocked.
    if (target?.kind === "click") target.el.click();
    const res = await pending;
    state.busy = state.applying = false;
    if (state.job?.url !== data.url) return render(); // the user moved to another job meanwhile
    if (failed(res)) return;

    setApp(res.application);
    const next = {
      link: "Tracked. Filling the application in the new tab.",
      none: "Tracked. Click the site's apply button and job-tracker will fill the form.",
    };
    setMessage("success", next[open] ?? "Tracked. Filling the application…");
    if (open === "click" || open === "form") JT.autofill.start();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  // Every focusable control carries a stable `data-focus` key, so focus can
  // survive the bar re-rendering from scratch (see captureFocus()).

  function segmented(key, options) {
    return h("div", { class: "segmented", role: "group" },
      ...options.map(([value, label]) =>
        h("button", {
          type: "button",
          "data-focus": `${key}:${value}`,
          "aria-pressed": String(state[key] === value),
          onclick: () => {
            state[key] = value;
            render();
          },
        }, label)),
    );
  }

  function textField(key, label) {
    return h("label", { class: "field" },
      h("span", { class: "label" }, label),
      h("input", {
        "data-focus": key,
        value: state.edits[key] ?? state.job[key],
        maxlength: key === "company" ? "100" : "150",
        placeholder: label,
        oninput: (event) => {
          state.edits[key] = event.target.value;
        },
      }),
    );
  }

  const section = (n, title, ...children) =>
    h("div", { class: "section" },
      h("div", { class: "section-head" }, h("b", {}, `[${n}]`), h("span", {}, title)),
      ...children);

  /** Quick view, laid out like the popup: [01] Target, [02] Config, [03] Details. */
  function quickView() {
    const facts = JT.quickFacts(state.job);
    return h("div", { class: "pop panel" },
      section("01", "Target", textField("role", "Role"), textField("company", "Company")),
      section("02", "Config",
        h("div", { class: "row" }, h("span", { class: "label" }, "CV"), segmented("cvType", CV_OPTIONS)),
        h("div", { class: "row" }, h("span", { class: "label" }, "Category"), segmented("category", CATEGORY_OPTIONS))),
      facts.length > 0 && section("03", "Details",
        h("div", { class: "chips" }, ...facts.map((fact) => h("span", { class: `chip ${fact.key}` }, fact.text)))),
    );
  }

  function statusSelect() {
    const current = state.app?.status ?? "";
    const dot = h("span", { class: `dot${state.app ? "" : " empty"}` });
    if (STATUSES[current]) dot.style.background = STATUSES[current].color;
    return h("label", { class: "status", title: "Status on your dashboard" },
      dot,
      h("select", {
        "aria-label": "Status",
        "data-focus": "status",
        disabled: state.busy,
        onchange: (event) => setStatus(event.target.value),
      },
        !state.app && h("option", { value: "", selected: true, disabled: true }, "Not tracked"),
        ...Object.entries(STATUSES).map(([value, { label }]) =>
          h("option", { value, selected: value === current }, label))),
    );
  }

  /**
   * `[ok] Saved and bookmarked.` under the bar. The bar re-renders from
   * scratch, so the entrance and countdown animations are offset by the
   * message's age instead of restarting on every render.
   */
  function messageView(message) {
    const age = Date.now() - message.at;
    const el = h("p", {
      class: `pop message${age < 150 ? " fresh" : ""}`,
      "data-tone": message.tone,
      role: message.tone === "error" ? "alert" : "status",
    },
      h("span", { class: "tag" }, message.tone === "error" ? "[error]" : "[ok]"),
      h("span", { class: "text" }, message.text),
      message.action && h("button", {
        class: "action",
        type: "button",
        "data-focus": "message-action",
        onclick: () => send({ type: "open", page: message.action.page }),
      }, message.action.label),
      h("button", {
        class: "dismiss",
        type: "button",
        "aria-label": "Dismiss",
        "data-focus": "message-dismiss",
        onclick: () => setMessage(),
      }, "×"));
    if (message.tone === "success") el.style.setProperty("--elapsed", `-${age}ms`);
    return el;
  }

  /** `focusKey` stays the same while the icon and label change (bookmark ⇄ star, copy ⇄ check). */
  function iconButton(focusKey, name, label, onclick, { active = false, pressed } = {}) {
    return h("button", {
      class: `icon-btn${active ? " active" : ""}`,
      type: "button",
      "data-focus": focusKey,
      title: label,
      "aria-label": label,
      "aria-pressed": pressed === undefined ? false : String(pressed),
      disabled: state.busy,
      onclick,
    }, icon(name, { filled: (name === "star" || name === "bookmark") && active }));
  }

  function barContent() {
    const flagged = Boolean(state.app?.starred);
    // A job not yet applied to is bookmarked; once applied, the same flag is a star.
    const bookmark = !state.app || state.app.status === "saved";
    const [flagIcon, flagLabel] = bookmark
      ? ["bookmark", flagged ? "Remove bookmark" : "Bookmark"]
      : ["star", flagged ? "Unstar" : "Star"];
    const refill = state.app && state.app.status !== "saved";
    const { message } = state;
    return h("div", { class: "anchor" },
      h("div", { class: "strip" },
        statusSelect(),
        iconButton("flag", flagIcon, flagLabel, toggleFlag, { active: flagged, pressed: flagged }),
        iconButton("open", "open", state.app ? "Open on dashboard" : "Open dashboard", openDashboard),
        iconButton("copy", state.copied ? "check" : "copy", state.copied ? "Copied" : "Copy job description", copyDescription, {
          active: state.copied,
        }),
        iconButton("quick-view", "chevron", state.open ? "Hide details" : "Quick view", () => {
          state.open = !state.open;
          render();
        }, { active: state.open, pressed: state.open }),
        h("button", { class: "primary", type: "button", "data-focus": "apply", disabled: state.busy, onclick: applyAndFill },
          state.applying ? "Working…" : refill ? "Fill again" : "Apply & fill")),
      message && messageView(message),
      state.open && quickView(),
    );
  }

  // ── Mounting ───────────────────────────────────────────────────────────────

  let inline = null;
  let floating = null;

  const isPlaced = ({ el, where }) => {
    if (where === "beforeend") return inline?.host.parentElement === el && el.lastElementChild === inline.host;
    return where === "beforebegin"
      ? inline?.host.nextElementSibling === el
      : inline?.host.previousElementSibling === el;
  };

  function mountInline(anchor) {
    if (!inline) {
      inline = shadowHost("job-tracker-bar");
      // Styled from outside the shadow root so the host sizes within the site's layout.
      Object.assign(inline.host.style, { position: "relative", zIndex: "3" });
    }
    if (!isPlaced(anchor)) anchor.el.insertAdjacentElement(anchor.where, inline.host);
    const style = anchor.block
      ? { display: "flex", justifyContent: "flex-end", width: "100%", margin: "8px 0 4px", alignSelf: "" }
      : anchor.fill
        ? { display: "inline-block", marginLeft: "auto", marginRight: "0", flex: "none", width: "", justifyContent: "", alignSelf: "center" }
        : { display: "inline-block", marginLeft: "auto", marginRight: "8px", flex: "none", width: "", justifyContent: "", alignSelf: "" };
    Object.assign(inline.host.style, style);
    if (anchor.fill) {
      // Stretch the site's row across its cell so the bar sits at its right end,
      // wrapping under the site's buttons when the pane is too narrow.
      // border-box, so a row with its own padding or border doesn't overflow its cell.
      Object.assign(anchor.el.style, { width: "100%", boxSizing: "border-box", flexWrap: "wrap", rowGap: "8px" });
    }
    inline.root.replaceChildren(barContent());
  }

  function mountFloating() {
    if (!floating) {
      floating = shadowHost("job-tracker-bar");
      floating.root.className = "corner bottom floating";
    }
    if (!floating.host.isConnected) document.documentElement.append(floating.host);
    floating.root.replaceChildren(
      barContent(),
      h("button", {
        class: "hide", type: "button", title: "Hide on this job", "aria-label": "Hide on this job", "data-focus": "hide",
        onclick: () => {
          state.hiddenUrl = state.job.url;
          render();
        },
      }, "×"),
    );
  }

  function render() {
    const previous = captureFocus();
    if (!state.job || state.hiddenUrl === state.job.url) {
      inline?.host.remove();
      floating?.host.remove();
      return;
    }
    const anchor = JT.anchor();
    if (anchor) {
      floating?.host.remove();
      mountInline(anchor);
    } else {
      inline?.host.remove();
      mountFloating();
    }
    const mounted = anchor ? inline.root : floating.root;
    openPopovers(mounted);
    // Only hand focus back within the same bar; moving between the inline and
    // floating bar is the page changing under the user, not a re-render.
    if (!previous || previous === mounted) restoreFocus(mounted);
  }

  // ── Focus ──────────────────────────────────────────────────────────────────
  // Rendering replaces every control, which would drop keyboard focus (and a
  // text field's caret) after each click or keystroke-triggered update. The
  // focused control's `data-focus` key is noted before rendering and focused
  // again after. When that control is disabled for a moment (the bar is busy),
  // focus comes back on a later render, unless the user has moved it elsewhere.

  let wantedFocus = null;

  /** Notes which control has focus; returns the bar's root that's on the page (or null). */
  function captureFocus() {
    const root = inline?.host.isConnected ? inline.root : floating?.host.isConnected ? floating.root : null;
    const active = root?.getRootNode().activeElement;
    if (active?.dataset.focus) {
      const caret = typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;
      wantedFocus = { key: active.dataset.focus, caret };
    } else if (document.activeElement && document.activeElement !== document.body) {
      // Focus is on the page itself; never pull it back into the bar.
      wantedFocus = null;
    }
    return root;
  }

  function restoreFocus(root) {
    if (!wantedFocus) return;
    const el = root.querySelector(`[data-focus="${wantedFocus.key}"]`);
    if (!el || el.disabled) return;
    el.focus({ preventScroll: true });
    if (wantedFocus.caret) el.setSelectionRange(...wantedFocus.caret);
    wantedFocus = null;
  }

  // ── Popovers ───────────────────────────────────────────────────────────────
  // The message and quick view open in the top layer, so the job pane's
  // overflow: hidden and stacking can't clip or cover them. Being fixed, they're
  // placed against the bar here and follow it as the page (or the pane) scrolls.

  const POP_GAP = 6;
  const EDGE = 8;
  let popRoot = null;
  let positionFrame = 0;

  function openPopovers(root) {
    popRoot = root;
    for (const pop of root.querySelectorAll(".pop")) {
      pop.popover = "manual";
      if (!pop.matches(":popover-open")) pop.showPopover();
    }
    positionPopovers();
  }

  /** Stacks the popovers below the bar (above it for the floating bar), right-aligned to it. */
  function positionPopovers() {
    positionFrame = 0;
    const strip = popRoot?.querySelector(".strip");
    const pops = popRoot ? Array.from(popRoot.querySelectorAll(".pop")) : [];
    if (!strip || !pops.length) return;
    const bar = strip.getBoundingClientRect();
    const up = Boolean(popRoot.closest(".floating"));
    let edge = up ? bar.top - POP_GAP : bar.bottom + POP_GAP;
    for (const pop of pops) {
      const { width, height } = pop.getBoundingClientRect();
      const left = Math.max(EDGE, Math.min(bar.right - width, window.innerWidth - width - EDGE));
      const top = up ? edge - height : edge;
      Object.assign(pop.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
      edge = up ? top - POP_GAP : top + height + POP_GAP;
    }
  }

  function schedulePosition() {
    if (!positionFrame && popRoot?.querySelector(".pop")) positionFrame = requestAnimationFrame(positionPopovers);
  }
  // Capture phase, so scrolling inside the site's job pane counts too.
  window.addEventListener("scroll", schedulePosition, { capture: true, passive: true });
  window.addEventListener("resize", schedulePosition, { passive: true });

  /**
   * Called by the scan loop. Updates the bar when the open job changes, and
   * re-mounts it if the site re-rendered around it. Touches the DOM only
   * when something changed, so it doesn't feed the page's own observers.
   */
  async function refresh() {
    const job = JT.readJob();
    if (!job) {
      // Mid-switch between jobs: keep the bar until the new job has rendered.
      if (JT.jobSettling()) return;
      if (state.job) {
        state.job = null;
        render();
      }
      return;
    }

    if (state.job?.url === job.url) {
      if (job.description.length > state.job.description.length) state.job.description = job.description;
      if (job.company !== state.job.company || job.role !== state.job.role) {
        // The title landed after the URL: take the real role and company and look the job up again.
        Object.assign(state.job, { company: job.company, role: job.role });
        setApp(null);
        render();
        check();
        return;
      }
      const anchor = JT.anchor();
      const misplaced = anchor ? !isPlaced(anchor) : !floating?.host.isConnected;
      if (misplaced) render();
      backfill();
      return;
    }

    Object.assign(state, { job, edits: { company: null, role: null }, app: null, message: null, open: false });
    wantedFocus = null; // a different job: don't carry focus over from the last one
    render();
    check();
  }

  let lookup = 0;

  /**
   * Sets the tracked application from an answer the bar can trust (a save, or
   * the latest lookup). Any lookup still in flight started before this and is
   * dropped when it lands, so it can't put "Not tracked" back over a save.
   */
  function setApp(app) {
    lookup++;
    state.app = app;
  }

  /**
   * Looks the open job up on the dashboard. Only the latest lookup is applied,
   * so an answer for an earlier job (or an earlier guess at this one) is dropped.
   */
  async function check() {
    if (!state.job) return;
    const token = ++lookup;
    const job = { ...state.job };
    const res = await send({ type: "job:check", job });
    if (token !== lookup || state.job?.url !== job.url || res?.error) return;
    const first = !state.app;
    state.app = res.application ?? null;
    if (first) {
      // The CV and category the dashboard has, or the ones suggested for this job.
      state.cvType = state.app?.cvType ?? res.cvType ?? "software";
      state.category = state.app?.category ?? res.category ?? "";
    }
    render();
    backfill();
  }

  /** Catches changes made elsewhere (the dashboard, another tab) when the tab comes back into view. */
  function recheck() {
    if (state.job && !state.busy) check();
  }

  JT.bar = { refresh, recheck };
})();
