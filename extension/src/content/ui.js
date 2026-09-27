/**
 * Shared building blocks for the injected UI: an element builder, icons and
 * one stylesheet mirroring the dashboard's tokens (app/app.css). Everything is
 * rendered inside closed shadow roots, so page styles can't leak in and page
 * scripts can't reach our controls.
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.ui) return;

  /** Creates an element. Children are appended as nodes or text, never parsed as HTML. */
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === false || value == null) continue;
      if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
      else if (key === "class") el.className = value;
      else el.setAttribute(key, value === true ? "" : value);
    }
    el.append(...children.filter((child) => child != null && child !== false));
    return el;
  }

  const ICON_PATHS = {
    star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
    bookmark: "M18 20l-6-3.5L6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1z",
    open: "M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    check: "M5 12.5l4.5 4.5L19 7",
    chevron: "M6 9l6 6 6-6",
  };

  const SVG = "http://www.w3.org/2000/svg";

  function icon(name, { filled = false } = {}) {
    const svg = document.createElementNS(SVG, "svg");
    const attrs = {
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      fill: filled ? "currentColor" : "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    };
    for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", ICON_PATHS[name]);
    svg.append(path);
    return svg;
  }

  const CSS = `
    :host { all: initial; }

    /* Tokens (app/app.css). \`all\` doesn't reset custom properties, so they survive the reset above. */
    :host {
      --bg: #0c0c0e; --bg-raised: #141519; --fill: #18191d;
      --text: #ececec; --text-2: #a6a7ad; --text-3: #6e6f76; --inverse: #0c0c0e;
      --stroke: rgba(255,255,255,.11); --stroke-2: rgba(255,255,255,.06);
      --accent: #e8b33c; --green: #58b68a; --red: #d1707a;
      --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      --sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }

    /* A row of hairline-divided segments: the action bar and the autofill bar. */
    .strip {
      display: inline-flex; align-items: stretch; height: 32px;
      background: var(--bg); border: 1px solid var(--stroke); color: var(--text-2);
      font: 500 10.5px/1 var(--mono); letter-spacing: .06em; text-transform: uppercase;
      -webkit-font-smoothing: antialiased;
    }
    .strip > * + * { border-left: 1px solid var(--stroke-2); }
    .strip button, .strip select {
      all: unset; box-sizing: border-box; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .strip button:hover, .strip label:hover { background: var(--fill); color: var(--text); }
    .strip button:focus-visible, .strip label:focus-within { outline: 1px solid rgba(255,255,255,.5); outline-offset: -1px; }
    .strip [disabled] { opacity: .4; pointer-events: none; }

    .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; background: var(--text-3); }
    .dot.on { background: var(--green); }
    .dot.empty { background: transparent; box-shadow: inset 0 0 0 1px var(--text-3); }

    /* Action bar */
    .status { display: inline-flex; align-items: center; gap: 7px; padding: 0 8px 0 10px; cursor: pointer; }
    .status option { background: var(--bg-raised); color: var(--text); text-transform: none; }
    /* Fixed widths, so saving (the "Not tracked" option goes away) or relabelling doesn't shift the bar. */
    .status select { width: 12.5ch; }
    .strip .icon-btn { width: 32px; }
    .strip .icon-btn.active { color: var(--accent); }
    .icon-btn svg { width: 15px; height: 15px; }
    .strip .primary { min-width: 18ch; padding: 0 14px; background: var(--text); color: var(--inverse); font-weight: 600; letter-spacing: .08em; }
    .strip .primary:hover { background: #fff; color: var(--inverse); }

    /*
     * Popovers under the bar: message and quick view. They open in the top
     * layer (the Popover API), so the site's overflow: hidden panes and
     * stacking contexts can't clip them or draw over them; bar.js places them
     * against the bar and follows it on scroll.
     */
    .anchor { position: relative; display: inline-block; text-align: left; }
    .pop {
      position: fixed; inset: auto; margin: 0; padding: 0; overflow: visible;
      background: var(--bg); color: var(--text); border: 1px solid var(--stroke); box-shadow: 0 16px 48px rgba(0,0,0,.5);
    }
    .pop:not(:popover-open) { display: none; }
    /* Confirmation: [ok] / [error] tag, tone edge, no drop shadow (the dashboard's flat style). */
    .message {
      --tone: var(--text-3);
      display: flex; align-items: center; gap: 10px; width: max-content; max-width: 360px;
      margin: 0; padding: 0 4px 0 12px; min-height: 34px; overflow: hidden;
      font: 500 10.5px/1.45 var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--text);
      box-shadow: inset 2px 0 0 var(--tone);
    }
    .message[data-tone="success"] { --tone: var(--green); }
    .message[data-tone="error"] { --tone: var(--red); border-color: rgba(209,112,122,.22); }
    .message .tag { flex: none; color: var(--tone); font-weight: 600; }
    .message .text { padding: 9px 0; }
    .message button { all: unset; box-sizing: border-box; cursor: pointer; flex: none; }
    .message .action { padding: 4px 8px; border: 1px solid var(--stroke); color: var(--text); }
    .message .action:hover { background: var(--fill); }
    .message .dismiss { width: 26px; height: 26px; display: grid; place-items: center; color: var(--text-3); font-size: 14px; }
    .message .dismiss:hover { color: var(--text); }
    .message button:focus-visible { outline: 1px solid rgba(255,255,255,.5); outline-offset: -1px; }
    /* Countdown hairline for confirmations that close themselves (4s, bar.js SUCCESS_MS). */
    .message[data-tone="success"]::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
      background: var(--tone); opacity: .6; transform-origin: left;
      animation: jt-drain 4s linear var(--elapsed, 0ms) forwards;
    }
    .message.fresh { animation: jt-rise .16s ease-out; }
    .floating .message.fresh { animation-name: jt-rise-up; }
    @keyframes jt-rise { from { opacity: 0; transform: translateY(-4px); } }
    @keyframes jt-rise-up { from { opacity: 0; transform: translateY(4px); } }
    @keyframes jt-drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) {
      .message.fresh { animation: none; }
      .message[data-tone="success"]::after { animation: none; opacity: 0; }
    }
    .panel { width: 360px; max-width: calc(100vw - 16px); padding: 2px 16px; color: var(--text); font: 12.5px/1.4 var(--mono); }

    /* Quick view, laid out like the popup */
    .section { border-top: 1px dashed var(--stroke); padding: 14px 0; }
    .section:first-child { border-top: none; }
    .section-head { display: flex; gap: 7px; margin-bottom: 11px; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
    .section-head b { color: var(--text); font-weight: 600; }
    .section-head span, .label { color: var(--text-3); }
    .label { font-size: 10px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field + .field, .row + .row { margin-top: 12px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    input {
      all: unset; box-sizing: border-box; width: 100%; height: 32px; padding: 0 10px;
      background: var(--bg); color: var(--text); border: 1px solid var(--stroke-2); font: 12.5px var(--sans);
    }
    input:hover { border-color: var(--stroke); }
    input:focus { border-color: rgba(255,255,255,.3); }
    .segmented { display: inline-flex; border: 1px solid var(--stroke-2); }
    .segmented button {
      all: unset; cursor: pointer; padding: 5px 8px; border-left: 1px solid var(--stroke-2);
      color: var(--text-2); font: 500 10px var(--mono); letter-spacing: .05em; text-transform: uppercase;
    }
    .segmented button:first-child { border-left: none; }
    .segmented button:hover { color: var(--text); background: var(--fill); }
    .segmented button[aria-pressed="true"] { background: var(--text); color: var(--inverse); }
    .segmented button:focus-visible { outline: 1px solid rgba(255,255,255,.5); outline-offset: 2px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { padding: 4px 8px; border: 1px solid var(--stroke); color: var(--text-2); font-size: 10.5px; letter-spacing: .04em; text-transform: uppercase; }
    .chip.salary { color: var(--green); border-color: rgba(88,182,138,.22); }
    .chip.applicants { color: var(--accent); border-color: rgba(232,179,60,.22); }

    /* Floating fallback (sites without an anchor) and the autofill bar */
    .corner { position: fixed; right: 16px; z-index: 2147483647; display: flex; align-items: flex-start; gap: 6px; }
    .corner.bottom { bottom: 16px; }
    .corner.top { top: 16px; }
    .hide { all: unset; cursor: pointer; width: 20px; height: 32px; display: grid; place-items: center; color: var(--text-3); font-size: 14px; }
    .hide:hover { color: var(--text); }
    .fill-bar { max-width: min(520px, calc(100vw - 32px)); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
    .fill-bar > span { display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; white-space: nowrap; }
    .fill-bar .title { color: var(--text); }
    .fill-bar .job {
      display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis;
      font: 12px/30px var(--sans); text-transform: none; letter-spacing: 0;
    }
    .fill-bar .count { color: var(--green); font-variant-numeric: tabular-nums; }
    .fill-bar button { padding: 0 12px; color: var(--text); }
  `;

  let sheet = null;

  /**
   * Creates a host element with a closed shadow root using the shared sheet.
   * @returns {{ host: HTMLElement, root: HTMLElement }}
   */
  function shadowHost(tag) {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
    }
    const host = document.createElement(tag);
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.adoptedStyleSheets = [sheet];
    const root = document.createElement("div");
    shadow.append(root);
    return { host, root };
  }

  /** Messages the service worker; resolves to { error } instead of rejecting. */
  const send = (message) =>
    chrome.runtime
      .sendMessage(message)
      .catch(() => ({ error: "job-tracker was updated. Refresh this page." }));

  JT.ui = { h, icon, shadowHost, send };
})();
