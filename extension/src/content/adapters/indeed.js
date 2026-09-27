/** Indeed adapter. Search pages no longer carry the job key in the URL; the apply link does. */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.adapters.some((a) => a.name === "indeed")) return;
  const { visible, visibleText, richText } = JT.dom;

  const indeedJobId = () => {
    const params = new URLSearchParams(location.search);
    return params.get("jk") ?? params.get("vjk");
  };

  JT.register({
    name: "indeed",
    summaryText: () =>
      [visible('[data-testid="desktop-job-header"]'), visible('[data-testid="jobDetailsSection"]')]
        .map((el) => el?.innerText ?? "")
        .join("\n"),
    host: /(^|\.)indeed\.[a-z.]+$/,
    job() {
      const role = visibleText('[data-testid="vj-job-title"], [data-testid="jobsearch-JobInfoHeader-title"], .jobsearch-JobInfoHeader-title');
      if (!role) return null;
      // Search pages no longer put the job key in the URL; the apply link carries it.
      const apply = this.applyControl();
      let id = indeedJobId();
      try {
        id ??= apply?.href ? new URL(apply.href).searchParams.get("jk") : null;
      } catch {
        // Not a URL; fall back to the page URL below.
      }
      const description =
        visible("#jobDescriptionText") ?? visible('[data-testid="vj-job-description-heading"]')?.parentElement;
      return {
        role: role.replace(/\s*-\s*job post$/i, ""),
        company: visibleText('[data-testid="company-info-metadata"] a, [data-testid="inlineHeader-companyName"], [data-company-name="true"]'),
        description: description ? richText(description) : "",
        url: id ? `${location.origin}/viewjob?jk=${encodeURIComponent(id)}` : location.href,
      };
    },
    applyControl: () =>
      visible('[data-testid="viewjob-apply"], #indeedApplyButton, [data-testid="indeedApplyButton"], #applyButtonLinkContainer a, #applyButtonLinkContainer button'),
  });
})();
