/**
 * Job capture: dispatches to the site adapter for this host, falling back to
 * structured data (JSON-LD, microdata) and generic selectors.
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.extractJob) return;
  const { LIMITS } = JT;
  const { clean, cleanBlock, isVisible, visible, meta, richText, titleCase, httpUrl } = JT.dom;
  const { jsonLdJob, microdataJob } = JT.structured;

  const APPLY_TEXT = /^(easy apply|quick apply|apply( now| online| here| for this (job|role|position)| on (the )?company (site|website))?|i'?m interested)$/i;

  /** The adapter for this page, if its host matches and it's active on this path. */
  const siteFor = () =>
    JT.adapters.find((a) => a.host.test(location.hostname) && (!a.activeOn || a.activeOn(location.pathname))) ?? null;

  // ── Generic capture ──────────────────────────────────────────────────────

  /** Hosted applicant tracking systems put the company in the path or subdomain. */
  const ATS_PATH = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com)$/;
  const ATS_SUBDOMAIN = /\.(myworkdayjobs\.com|myworkdaysite\.com|teamtailor\.com|bamboohr\.com|recruitee\.com|breezy\.hr|pinpointhq\.com|personio\.(de|com)|jobvite\.com|icims\.com|applytojob\.com)$/;
  /** Job boards list many employers, so their hostname says nothing about the company. */
  const JOB_BOARDS = /(^|\.)(linkedin|indeed|glassdoor|reed|totaljobs|monster|ziprecruiter|otta|welcometothejungle|google|cv-library|gradcracker|prospects|targetjobs|bebee)\./;

  const host = () => location.hostname.replace(/^www\./, "");

  function companyFromUrl() {
    const h = host();
    if (ATS_PATH.test(h)) {
      const slug = location.pathname.split("/").filter(Boolean)[0];
      return slug && !/^(embed|jobs?|o|j)$/.test(slug) ? titleCase(slug) : "";
    }
    if (ATS_SUBDOMAIN.test(h)) return titleCase(h.split(".")[0].replace(/\d+$/, ""));
    if (JOB_BOARDS.test(`${h}.`)) return "";
    const labels = h.split(".");
    // careers.acme.co.uk → acme
    const name = labels.length > 2 && labels.at(-2).length <= 3 ? labels.at(-3) : labels.at(-2);
    return name ? titleCase(name) : "";
  }

  const COMPANY_SELECTORS = [
    "[data-company-name]",
    '[class*="company-name"]',
    '[class*="companyName"]',
    '[data-automation-id="company"]',
  ];

  const ROLE_SELECTORS = [
    '[data-automation-id="jobPostingHeader"]',
    ".posting-headline h2",
    ".app-title",
    ".job-title",
    '[class*="job-title"]',
    "h1",
  ];

  const DESCRIPTION_SELECTORS = [
    '[data-automation-id="jobPostingDescription"]',
    "#job-description",
    ".job-description",
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[class*="posting-description"]',
    "#content",
    "article",
    "main",
  ];

  function firstText(selectors, min = 1, read = (el) => el.innerText) {
    for (const selector of selectors) {
      const el = visible(selector);
      const text = el ? read(el)?.trim() : "";
      if (text && text.length >= min) return text;
    }
    return "";
  }

  /** "Engineer at Acme | Careers" → { role: "Engineer", company: "Acme" } */
  function splitTitle(title) {
    const at = title.match(/^(.+?)\s+(?:at|@)\s+(.+?)(?:\s+[|\-–—·]\s+.*)?$/i);
    if (at) return { role: clean(at[1]), company: clean(at[2]) };
    return { role: clean(title.split(/\s+[|\-–—·]\s+/)[0]), company: "" };
  }

  function genericJob() {
    const structured = jsonLdJob() ?? microdataJob() ?? {};
    const fromTitle = splitTitle(meta("og:title") || document.title);
    return {
      role: structured.role || clean(firstText(ROLE_SELECTORS)) || fromTitle.role,
      company:
        structured.company ||
        clean(firstText(COMPANY_SELECTORS)) ||
        fromTitle.company ||
        meta("og:site_name") ||
        companyFromUrl(),
      description:
        structured.description ||
        firstText(DESCRIPTION_SELECTORS, 200, richText) ||
        meta("og:description") ||
        meta("description"),
      url: location.href,
    };
  }

  const normalise = (job) => ({
    company: clean(job.company, LIMITS.company),
    role: clean(job.role, LIMITS.role),
    url: job.url || location.href,
    description: cleanBlock(job.description, LIMITS.description),
  });

  /** Whether the generic reader should treat this page as a single job posting. */
  function looksLikeJobPage() {
    // A supported site outside its job pages (LinkedIn's feed, Google web search).
    if (JT.adapters.some((a) => a.host.test(location.hostname))) return false;
    if (jsonLdJob() || microdataJob()) return true;
    const h = host();
    return (ATS_PATH.test(h) || ATS_SUBDOMAIN.test(h)) && Boolean(visible("h1, h2"));
  }

  /**
   * The job open on this page, or null when the page isn't showing one
   * (search pages count only while a job is open in their detail pane).
   * @returns {{ company: string, role: string, url: string, description: string } | null}
   */
  function readJob() {
    const site = siteFor();
    if (site) {
      const job = site.job();
      return job ? normalise(job) : null;
    }
    return looksLikeJobPage() ? normalise(genericJob()) : null;
  }

  /**
   * People the open listing suggests reaching out to, from sites that show
   * them (LinkedIn). Rendered lazily, so callers re-read it like the description.
   * @returns {{ name: string, profileUrl: string, degree: string, headline: string, note: string }[]}
   */
  const readContacts = () => siteFor()?.contacts?.() ?? [];

  /** The site is switching to another job and readJob() is holding off until it has. */
  const jobSettling = () => siteFor()?.settling?.() ?? false;

  /** Best-effort read of any page, for the popup: never null. */
  const extractJob = () => readJob() ?? normalise(genericJob());

  /** Where the action bar mounts: the adapter's anchor, else right after the site's apply control. */
  function anchor() {
    const site = siteFor();
    if (!site) return null;
    if (site.anchor) return site.anchor();
    const el = site.applyControl();
    return el ? { el, where: "afterend" } : null;
  }

  /**
   * How to get from this listing to the application form: a link to open,
   * a control to click (buttons that open a modal or a new tab), or null
   * when the page offers neither.
   * @returns {{ kind: "link", href: string } | { kind: "click", el: HTMLElement } | null}
   */
  function findApplyTarget() {
    const control =
      siteFor()?.applyControl() ??
      Array.from(document.querySelectorAll("a[href], button, [role='button'], input[type='submit']")).find(
        (el) => isVisible(el) && APPLY_TEXT.test(clean(el.innerText || el.value || el.getAttribute("aria-label"))),
      );
    if (!control) return null;
    const href = control instanceof HTMLAnchorElement ? httpUrl(control.href) : "";
    if (href && !href.startsWith(`${location.href.split("#")[0]}#`)) return { kind: "link", href };
    return { kind: "click", el: control };
  }

  // Header facts are read from the adapter's header text first, since
  // descriptions often mention other roles' terms ("remote teams", "£ budget").
  const FACTS = [
    ["posted", /\b(?:(?:\d+|an?|one)\s+(?:minute|hour|day|week|month)s?\s+ago|just posted|posted today)\b/i],
    ["applicants", /\b(?:over\s+)?\d[\d,]*\+?\s+(?:applicants|people clicked apply)\b/i],
    ["workType", /\b(?:remote|hybrid|on-site|onsite)\b/i],
    ["employment", /\b(?:full-time|part-time|contract|internship|temporary|permanent)\b/i],
    ["salary", /[£$€]\s?\d[\d,.]*\s?[kK]?(?:\s?[-–]\s?[£$€]?\s?\d[\d,.]*\s?[kK]?)?(?:\s?(?:per|\/|a)\s?(?:year|annum|yr|hour|hr|month))?/],
  ];

  /**
   * Facts for the quick view and the saved record: location, posted,
   * applicants, work type, employment type and salary, when the page states them.
   * @returns {{ key: string, text: string }[]}
   */
  function quickFacts(job) {
    const site = siteFor();
    const header = site?.summaryText?.() ?? "";
    const description = (job?.description ?? "").slice(0, 3000);
    const facts = [];
    const location = clean(site?.location?.(), 100);
    if (location) facts.push({ key: "location", text: location });
    for (const [key, pattern] of FACTS) {
      const match = header.match(pattern) ?? description.match(pattern);
      if (match) facts.push({ key, text: clean(match[0], 60) });
    }
    return facts;
  }

  const UNIT_MS = { minute: 60e3, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6 };

  /** "3 days ago" / "an hour ago" / "posted today" as an ISO date, or undefined. */
  function postedDate(text) {
    if (!text) return undefined;
    if (/just posted|posted today/i.test(text)) return new Date().toISOString();
    const match = text.match(/(\d+|an?|one)\s+(minute|hour|day|week|month)s?\s+ago/i);
    if (!match) return undefined;
    const count = /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
    return new Date(Date.now() - count * UNIT_MS[match[2].toLowerCase()]).toISOString();
  }

  Object.assign(JT, { readJob, readContacts, jobSettling, extractJob, anchor, findApplyTarget, quickFacts, postedDate });
})();
