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
    lines: "M4 6h16M4 12h10M4 18h7",
    close: "M6 6l12 12M18 6L6 18",
    alert: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4.5M12 16h.01",
  };

  const SVG = "http://www.w3.org/2000/svg";

  function icon(name, { filled = false } = {}) {
    const svg = document.createElementNS(SVG, "svg");
    const attrs = {
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      fill: filled ? "currentColor" : "none",
      stroke: "currentColor",
      "stroke-width": "1.5",
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

    /* Tokens (app/app.css) as light-dark pairs; the host's data-theme picks the scheme. \`all\` doesn't reset custom properties. */
    :host([data-theme="dark"]) { color-scheme: dark; }
    :host([data-theme="system"]) { color-scheme: light dark; }
    :host {
      color-scheme: light;
      --bg: light-dark(#fafaf8, #0c0c0e); --surface: light-dark(#ffffff, #212227);
      --text: light-dark(#16171a, #ececec); --text-2: light-dark(#3f4147, #a6a7ad); --text-3: light-dark(#5c5e64, #86878e);
      --inverse: light-dark(#fafaf8, #0c0c0e); --primary-hover: light-dark(#34363c, #ffffff);
      --stroke: light-dark(rgba(21,22,24,.22), rgba(255,255,255,.11)); --stroke-2: light-dark(rgba(21,22,24,.12), rgba(255,255,255,.06));
      --hover: light-dark(rgba(22,23,26,.04), rgba(255,255,255,.04)); --active: light-dark(rgba(22,23,26,.07), rgba(255,255,255,.07));
      --focus: light-dark(rgba(22,23,26,.5), rgba(255,255,255,.5));
      --brand: #e5484d; --accent: light-dark(#8a5f14, #e8b33c); --green: light-dark(#2a7350, #58b68a); --red: light-dark(#ab3a45, #d1707a);
      --status-saved: light-dark(#85878e, #4a4c53); --status-applied: light-dark(#4c4e55, #d4d4d8);
      --status-screening: light-dark(#5f6168, #a6a7ad); --status-interview: light-dark(#8a5f14, #e8b33c);
      --status-assessment: light-dark(#a15c2e, #f0cf85); --status-offer: light-dark(#2a7350, #58b68a);
      --status-accepted: light-dark(#146b45, #8fd0ae); --status-rejected: light-dark(#ab3a45, #d1707a);
      --status-ghosted: light-dark(#6b6d74, #86878e); --status-withdrawn: light-dark(#85878e, #4a4c53);
      --shadow: 0 24px 64px rgba(0,0,0,.22);
      --sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }

    /* A row of hairline-divided segments: the action bar and the autofill bar. */
    .strip {
      display: inline-flex; align-items: stretch; height: 34px;
      background: var(--bg); border: 1px solid var(--stroke); color: var(--text-2);
      font: 500 13px/1 var(--sans); -webkit-font-smoothing: antialiased;
    }
    .strip > * + * { border-left: 1px solid var(--stroke-2); }
    .strip button, .strip select {
      all: unset; box-sizing: border-box; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .strip button:hover, .strip label:hover { background: var(--hover); color: var(--text); }
    .strip button:focus-visible, .strip label:focus-within { outline: 1px solid var(--focus); outline-offset: -1px; }
    .strip [disabled] { opacity: .4; pointer-events: none; }

    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--text-3); }
    .dot.on { background: var(--green); }
    .dot.empty { background: transparent; box-shadow: inset 0 0 0 1px var(--text-3); }

    /* Action bar */
    .status { display: inline-flex; align-items: center; gap: 7px; padding: 0 8px 0 10px; cursor: pointer; color: var(--text); }
    .status option { background: var(--surface); color: var(--text); }
    /* Fixed widths, so saving (the "Not tracked" option goes away) or relabelling doesn't shift the bar. */
    .status select { width: 11ch; }
    .strip .icon-btn { width: 34px; }
    .strip .text-btn { padding: 0 12px; }
    .strip .icon-btn.active { color: var(--accent); }
    .icon-btn svg { width: 16px; height: 16px; }
    .strip .primary { min-width: 13ch; padding: 0 14px; background: var(--text); color: var(--inverse); }
    .strip .primary:hover { background: var(--primary-hover); color: var(--inverse); }

    /*
     * Popovers under the bar: message and quick view. They open in the top
     * layer (the Popover API), so the site's overflow: hidden panes and
     * stacking contexts can't clip them or draw over them; bar.js places them
     * against the bar and follows it on scroll.
     */
    .anchor { position: relative; display: inline-block; text-align: left; }
    .pop {
      position: fixed; inset: auto; margin: 0; padding: 0; overflow: visible;
      background: var(--surface); color: var(--text); border: 1px solid var(--stroke); box-shadow: var(--shadow);
      font: 13.5px/1.4 var(--sans); -webkit-font-smoothing: antialiased;
    }
    .pop:not(:popover-open) { display: none; }
    /* Confirmation: an icon in the tone's colour, the text, an optional action and dismiss. */
    .message {
      --tone: var(--text-3);
      display: flex; align-items: center; gap: 10px; width: max-content; max-width: 380px;
      margin: 0; padding: 0 4px 0 12px; min-height: 38px; overflow: hidden; color: var(--text);
    }
    .message[data-tone="success"] { --tone: var(--green); }
    .message[data-tone="error"] { --tone: var(--red); }
    .message .tone { flex: none; display: grid; color: var(--tone); }
    .message .tone svg { width: 15px; height: 15px; }
    .message .text { padding: 9px 0; }
    .message button { all: unset; box-sizing: border-box; cursor: pointer; flex: none; font: 500 13px/1 var(--sans); }
    .message .action { padding: 6px 10px; border: 1px solid var(--stroke-2); color: var(--text); }
    .message .action:hover { border-color: var(--stroke); }
    .message .dismiss { width: 28px; height: 28px; display: grid; place-items: center; color: var(--text-3); }
    .message .dismiss svg { width: 14px; height: 14px; }
    .message .dismiss:hover { color: var(--text); background: var(--hover); }
    .message button:focus-visible { outline: 1px solid var(--focus); outline-offset: -1px; }
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
    .panel { width: 360px; max-width: calc(100vw - 16px); padding: 4px 16px; }

    /* Quick view, laid out like the popup */
    .section { padding: 14px 0; }
    .section + .section { border-top: 1px solid var(--stroke-2); }
    .section-title { margin: 0 0 10px; font-size: 12px; font-weight: 500; color: var(--text-3); }
    .label { font-size: 12.5px; color: var(--text-3); }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field + .field { margin-top: 12px; }
    input {
      all: unset; box-sizing: border-box; width: 100%; height: 36px; padding: 0 10px;
      background: var(--bg); color: var(--text); border: 1px solid var(--stroke-2); font: 13.5px var(--sans);
    }
    input:hover, input:focus { border-color: var(--stroke); }
    input::placeholder { color: var(--text-3); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { padding: 4px 8px; background: var(--hover); color: var(--text-2); font-size: 12.5px; }
    .chip.salary { color: var(--green); }
    .chip.applicants { color: var(--accent); }

    /* Floating fallback (sites without an anchor) and the autofill bar */
    .corner { position: fixed; right: 16px; z-index: 2147483647; display: flex; align-items: flex-start; gap: 6px; }
    .corner.bottom { bottom: 16px; }
    .corner.top { top: 16px; }
    .floating .strip, .fill-bar { box-shadow: var(--shadow); }
    .strip .pill { gap: 8px; padding: 0 12px; color: var(--text); }
    .pill .brand { font-weight: 600; letter-spacing: -.02em; }
    .pill .brand b { color: var(--brand); font-weight: 600; }
    .pill .sep { color: var(--text-3); }
    .pill .state { color: var(--text-2); }
    .pill svg { width: 12px; height: 12px; transition: transform .12s; }
    .pill[aria-expanded="true"] svg { transform: rotate(180deg); }

    /* Floating menu: the job up top, then one action per row */
    .menu { width: 270px; padding: 0; color: var(--text-2); }
    .menu-head { display: flex; flex-direction: column; gap: 2px; padding: 12px 12px 10px; border-bottom: 1px solid var(--stroke-2); }
    .menu-head .role { font-size: 14px; font-weight: 500; color: var(--text); }
    .menu-head .company { font-size: 12.5px; color: var(--text-3); }
    .menu-head .field + .field { margin-top: 8px; }
    .menu-items { display: flex; flex-direction: column; padding: 4px; }
    .menu-items > button, .menu-items > .status {
      all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px;
      height: 32px; padding: 0 8px; font-size: 13px;
    }
    .menu-items > button:hover, .menu-items > .status:hover { background: var(--hover); color: var(--text); }
    .menu-items > button:focus-visible, .menu-items > .status:focus-within { outline: 1px solid var(--focus); outline-offset: -1px; }
    .menu-items > button[disabled] { opacity: .4; pointer-events: none; }
    .menu-items > .status select { all: unset; flex: 1; cursor: pointer; }
    .menu-items > .status .dot { margin: 0 4px; }
    .menu-items svg { width: 15px; height: 15px; flex: none; }
    .menu-items .grow { flex: 1; }
    .menu-items .trail { color: var(--text-3); }
    .menu-items .active { color: var(--accent); }
    .menu-items .muted { color: var(--text-3); }
    .fill-bar { max-width: min(520px, calc(100vw - 32px)); }
    .fill-bar > span { display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; white-space: nowrap; }
    .fill-bar .title { color: var(--text); }
    .fill-bar .job { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 400; line-height: 32px; color: var(--text-3); }
    .fill-bar .count { color: var(--green); font-variant-numeric: tabular-nums; }
    .fill-bar button { padding: 0 12px; color: var(--text); }
    .fill-bar svg { width: 14px; height: 14px; }
  `;

  let sheet = null;

  const THEMES = ["light", "dark", "system"];
  const hosts = [];
  let theme = "light";
  const setTheme = (value) => {
    theme = THEMES.includes(value) ? value : "light";
    for (const host of hosts) host.dataset.theme = theme;
  };
  chrome.storage.sync.get("theme").then(({ theme: value }) => setTheme(value), () => {});
  chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes.theme) setTheme(changes.theme.newValue);
  });

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
    host.dataset.theme = theme;
    hosts.push(host);
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.adoptedStyleSheets = [sheet];
    const root = document.createElement("div");
    shadow.append(root);
    return { host, root };
  }

  /** Messages the service worker; resolves to { error } instead of rejecting. */
  const send = async (message) => {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return { error: "job-tracker was updated. Refresh this page." };
    }
  };

  JT.ui = { h, icon, shadowHost, send };
})();
