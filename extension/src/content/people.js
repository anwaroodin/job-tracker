(async () => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT?.ui || !JT.linkedinPeople || window !== window.top) return;

  const { h, icon, shadowHost, send } = JT.ui;
  const TARGET_KEY = "peopleTarget";
  const TARGET_TTL_MS = 2 * 60 * 60 * 1000;
  const PEOPLE_PAGE = /^\/(company\/[^/]+\/people|search\/results\/people)\b/;
  const MAX_PEOPLE = 10;
  const SETTLE_MS = 500;

  const { dashboardOrigin = "https://job-tracker.anwars.workers.dev" } = await chrome.storage.sync.get("dashboardOrigin");
  if (location.origin === dashboardOrigin) {
    document.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[data-jt-people-for]") : null;
      const id = link?.dataset.jtPeopleFor ?? "";
      if (!/^[\w-]+$/.test(id)) return;
      chrome.storage.local.set({ [TARGET_KEY]: { id, label: (link.dataset.jtLabel ?? "").slice(0, 120), at: Date.now() } });
    }, true);
    return;
  }
  if (!/(^|\.)linkedin\.com$/.test(location.hostname)) return;

  let saveTo = null;

  async function loadTarget() {
    const { [TARGET_KEY]: stored } = await chrome.storage.local.get(TARGET_KEY);
    saveTo = stored && Date.now() - stored.at < TARGET_TTL_MS ? stored : null;
  }

  let bar = null;
  let status = { state: "idle" };
  let timer = 0;

  function content(people, { id, label }) {
    if (status.state === "saved") {
      return h("div", { class: "strip" },
        h("span", { class: "pill" }, icon("check"), `Saved ${status.count} to ${label || "your application"}`),
        h("button", { class: "text-btn", type: "button", onclick: () => send({ type: "open", page: "application", applicationId: id }) }, "Open"),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Dismiss", onclick: stop }, icon("close")));
    }
    const saving = status.state === "saving";
    return h("div", { class: "strip" },
      h("span", { class: "pill" }, status.error ?? (label ? `For ${label}` : "j*b")),
      h("button", { class: "primary", type: "button", disabled: saving || !people.length, onclick: () => save(people, id) },
        saving ? "Saving…" : `Save ${people.length} ${people.length === 1 ? "person" : "people"}`),
      h("button", { class: "icon-btn", type: "button", "aria-label": "Dismiss", onclick: stop }, icon("close")));
  }

  async function save(people, id) {
    status = { state: "saving" };
    render();
    const res = await send({ type: "people:save", applicationId: id, people });
    status = res?.error ? { state: "idle", error: res.error === "signed_out" ? "Sign in to j*b first" : "Couldn't save. Try again." } : { state: "saved", count: res.saved };
    render();
  }

  function stop() {
    chrome.storage.local.remove(TARGET_KEY);
    saveTo = null;
    bar?.host.remove();
  }

  function render() {
    if (!saveTo || !PEOPLE_PAGE.test(location.pathname)) return bar?.host.remove();
    if (!bar) {
      bar = shadowHost("job-tracker-people");
      bar.root.className = "corner bottom floating";
    }
    if (!bar.host.isConnected) document.documentElement.append(bar.host);
    bar.root.replaceChildren(content(JT.linkedinPeople(MAX_PEOPLE), saveTo));
  }

  new MutationObserver((records) => {
    if (bar && records.every((record) => bar.host.contains(record.target))) return;
    clearTimeout(timer);
    timer = setTimeout(render, SETTLE_MS);
  }).observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && TARGET_KEY in changes) loadTarget().then(render);
  });

  await loadTarget();
  render();
})();
