/** Google Jobs adapter: the job detail panel in Google search. */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.adapters.some((a) => a.name === "google")) return;
  const { clean, isVisible, blockText, httpUrl } = JT.dom;

  /** Google's jobs panel: the visible level-1 heading inside a block that offers "Apply on …" links. */
  function googlePanel() {
    for (const heading of document.querySelectorAll('[role="heading"][aria-level="1"]')) {
      if (!isVisible(heading) || !heading.innerText.trim()) continue;
      let node = heading.parentElement;
      for (let depth = 0; node && depth < 10; depth++, node = node.parentElement) {
        const links = Array.from(node.querySelectorAll("a[href]")).filter(
          (a) => isVisible(a) && /^apply\b/i.test(a.innerText.trim()),
        );
        if (links.length) return { heading, root: node, links };
      }
    }
    return null;
  }

  JT.register({
    name: "google",
    // "Company · Location · via Source"
    location: () => {
      const panel = googlePanel();
      const subtitle = panel ? panel.heading.parentElement.innerText.replace(panel.heading.innerText, "").trim() : "";
      return subtitle.split("\n")[0].split(/\s*[·•⋅]\s*/)[1] ?? "";
    },
    summaryText: () => googlePanel()?.heading.parentElement.parentElement?.innerText ?? "",
    host: /(^|\.)google\.[a-z.]+$/,
    job() {
      const panel = googlePanel();
      if (!panel) return null;
      const role = clean(panel.heading.innerText);
      // The line under the title reads "Company · Location · via Source".
      const subtitle = panel.heading.parentElement.innerText.replace(panel.heading.innerText, "").trim();
      const heading = Array.from(panel.root.querySelectorAll("h2, h3")).find((h) => /job description/i.test(h.innerText));
      // The description is collapsed behind "Show full description", so innerText misses most of it.
      const description = heading ? blockText(heading.parentElement, heading) : "";
      return {
        role,
        company: clean(subtitle.split("\n")[0].split(/\s*[·•⋅]\s*/)[0]),
        description,
        // Google's own URL for the panel doesn't survive; the first apply link identifies the job.
        url: httpUrl(panel.links[0].href),
      };
    },
    applyControl: () => googlePanel()?.links[0] ?? null,
  });
})();
