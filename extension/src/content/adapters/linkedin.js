/**
 * LinkedIn adapter. All LinkedIn DOM knowledge lives here.
 *
 * LinkedIn serves three layouts, switching between them by SPA navigation:
 * - A: the classic list/search side pane, addressable by stable BEM-ish classes;
 * - B: the standalone /jobs/view/ page (SDUI, hashed classes);
 * - C: the /jobs/search-results/ page (SDUI, cards and detail in one document).
 * SDUI markup is only addressable through ids, aria-labels, componentkey
 * prefixes and document.title, so that's all this adapter keys on there.
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.adapters.some((a) => a.name === "linkedin")) return;
  const { clean, isVisible, visibleText, richText } = JT.dom;

  /** LinkedIn's DOM contract: the one map to update when LinkedIn reshuffles its markup. */
  const SEL = {
    // Layout A top card. Both block classes are listed because LinkedIn runs renames as concurrent rollouts.
    topCard: ".job-details-jobs-unified-top-card, .job-details-jobs-unified-top-card__container--two-pane",
    topButtons: ".job-details-jobs-unified-top-card__top-buttons",
    jobTitle: ".job-details-jobs-unified-top-card__job-title",
    companyLink: ".job-details-jobs-unified-top-card__company-name a",
    // Description: layout A's container id, then the SDUI component key.
    jobDetailsId: "job-details",
    aboutJob: '[componentkey^="JobDetails_AboutTheJob"]',
    // The overflow button is the one unhashed hook in every layout; our button sits beside it.
    moreOptions: 'button[aria-label="More options"]',
    applyControl: '#jobs-apply-button-id, a[aria-label*="on company website" i], button[aria-label*="Easy Apply" i], a[aria-label*="Easy Apply" i]',
    companyAnchor: 'a[href*="/company/"]',
    // List cards. Page-wide queries for the open job must skip these.
    resultsCard: '[componentkey^="job-card-component-ref-"]',
    searchCard: "li[data-occludable-job-id]",
    // SDUI blocks keyed by job id, so an old job's block is never read as the open one's.
    aboutJobFor: (id) => `[componentkey="JobDetails_AboutTheJob_${id}"]`,
    peopleFor: (id) => `[componentkey="JobDetailsPeopleWhoCanHelpSlot_${id}"]`,
    cardFor: (id) => `[componentkey="job-card-component-ref-${id}"]`,
    profileLink: 'a[href*="linkedin.com/in/"], a[href^="/in/"]',
  };
  const CARD_SCOPES = `${SEL.searchCard}, ${SEL.resultsCard}`;
  const outsideCards = (el) => !el.closest(CARD_SCOPES);

  const jobId = () =>
    location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ??
    new URLSearchParams(location.search).get("currentJobId");

  /**
   * Decided from markers only one layout has, resolved per call because
   * LinkedIn swaps layouts without a page load. `#job-details` is tested first
   * so a classic search page, which also has cards, isn't read as C.
   */
  function layout() {
    if (document.getElementById(SEL.jobDetailsId)) return "A";
    if (document.querySelector(SEL.resultsCard)) return "C";
    return "B";
  }

  /** SDUI identity: document.title is "Title | Company | LinkedIn", split from the end so a " | " in the title survives. */
  function titleIdentity() {
    const segs = document.title.replace(/^\(\d+\)\s*/, "").split(" | ");
    if (segs.at(-1) === "LinkedIn") segs.pop();
    const company = segs.length >= 2 ? clean(segs.pop()) : "";
    return { role: clean(segs.join(" | ")), company };
  }

  function description(kind, id) {
    const el = kind === "A" ? document.getElementById(SEL.jobDetailsId) : document.querySelector(SEL.aboutJobFor(id));
    // Renders lazily and can sit empty for a while; callers re-read it before saving.
    return (el ? richText(el) : "").replace(/^\s*(## )?about the job\s*/i, "");
  }

  /**
   * Whether the detail pane shows the job in the URL yet. Switching jobs
   * changes the URL first; the title, header and description follow a moment
   * later, and reading in between pairs the new id with the old job's details.
   */
  function paneReady(id, kind) {
    if (kind === "A") {
      const link = document.querySelector(`${SEL.jobTitle} a[href*="/jobs/view/"]`);
      return !link || link.href.includes(`/jobs/view/${id}`);
    }
    // Another job's description block means the pane hasn't switched yet.
    if (document.querySelector(SEL.aboutJob) && !document.querySelector(SEL.aboutJobFor(id))) return false;
    // The title (role and company) can land after the pane; check both against the job's card
    // (role alone isn't enough: "Software Engineer" is inside "Software Engineer - Backend").
    const card = document.querySelector(SEL.cardFor(id));
    if (!card) return true;
    const text = clean(card.innerText).toLowerCase();
    const { role, company } = titleIdentity();
    return [role, company].every((part) => !part || text.includes(part.toLowerCase()));
  }

  function job() {
    const id = jobId();
    if (!id) return null;
    const kind = layout();
    if (!paneReady(id, kind)) return null;
    const identity =
      kind === "A"
        ? { role: visibleText(SEL.jobTitle), company: clean(document.querySelector(SEL.companyLink)?.textContent) }
        : titleIdentity();
    const company =
      identity.company ||
      clean(Array.from(document.querySelectorAll(SEL.companyAnchor)).find((a) => outsideCards(a) && a.textContent.trim())?.textContent);
    if (!identity.role) return null;
    return { role: identity.role, company, description: description(kind, id), url: `https://www.linkedin.com/jobs/view/${id}/` };
  }

  /** The open job's Apply / Easy Apply control, never a list card's or the "Easy Apply" search filter. */
  function applyControl() {
    return (
      Array.from(document.querySelectorAll(SEL.applyControl)).find(
        (el) => isVisible(el) && outsideCards(el) && !/filter/i.test(el.getAttribute("aria-label") ?? ""),
      ) ?? null
    );
  }

  /**
   * Where the inline button mounts. B and C put it at the end of the Apply
   * row when there is one. Otherwise, since cards and detail can share a
   * document and every card has its own "More options", the anchor is scoped
   * per layout: A to the top card, B page-wide (no cards on /jobs/view/), C to
   * the one button outside any card.
   */
  function anchor() {
    const kind = layout();
    if (kind !== "A") {
      // SDUI: on the Easy Apply / Save row, pushed to its right end. The row is
      // a flex strip shrink-wrapped in a grid cell, so the bar stretches it (`fill`).
      const row = applyControl()?.parentElement?.parentElement;
      if (row && getComputedStyle(row).display === "flex") return { el: row, where: "beforeend", fill: true };
    }

    let el = null;
    if (kind === "A") {
      const top = document.querySelector(SEL.topCard);
      el = top?.querySelector(SEL.topButtons) ?? top?.querySelector(SEL.moreOptions) ?? null;
    } else if (kind === "B") {
      el = location.pathname.includes("/jobs/view/") ? document.querySelector(SEL.moreOptions) : null;
    } else {
      el = Array.from(document.querySelectorAll(SEL.moreOptions)).find(outsideCards) ?? null;
    }
    if (!el) return null;
    // Mount on a line of its own under the header row (logo, company, buttons)
    // rather than inside it, so the bar never squeezes the company name.
    let row = el.parentElement;
    for (let depth = 0; row && depth < 4 && !row.querySelector(SEL.companyAnchor); depth++) row = row.parentElement;
    const top = document.querySelector(SEL.topCard);
    if (row?.querySelector(SEL.companyAnchor) && row !== top && !row.contains(document.querySelector("h1"))) {
      return { el: row, where: "afterend", block: true };
    }
    return { el, where: "beforebegin" };
  }

  // ── People to reach out to ─────────────────────────────────────────────────

  const PEOPLE_HEADING = /^(people you can reach out to|meet the hiring team)$/i;
  const DEGREE = /^[•·]?\s*(1st|2nd|3rd\+?)$/i;
  const DEGREE_SUFFIX = /\s*[•·]?\s*(1st|2nd|3rd\+?)$/i;
  const BUTTON_LINE = /^(message|connect|follow|view profile|show all|see all)$/i;
  const MAX_CONTACTS = 10;

  /** The job's own people section, never the company feed further down the page (it links profiles too). */
  function peopleSection(id, kind) {
    if (kind !== "A") {
      const slot = document.querySelector(SEL.peopleFor(id));
      if (slot) return slot;
    }
    const heading = Array.from(document.querySelectorAll("h2, h3")).find(
      (h) => outsideCards(h) && PEOPLE_HEADING.test(clean(h.textContent)),
    );
    return heading?.closest("section") ?? heading?.parentElement?.parentElement ?? null;
  }

  const profileKey = (a) => a.href.replace(/[?#].*$/, "");

  /**
   * People the listing suggests reaching out to: name, connection degree,
   * headline and LinkedIn's reason ("Job poster", "School alum from …").
   * Each person's lines come from the largest element holding only their links.
   */
  function contacts() {
    const id = jobId();
    const kind = layout();
    if (!id || !paneReady(id, kind)) return [];
    const section = peopleSection(id, kind);
    if (!section) return [];
    const people = new Map();
    for (const link of section.querySelectorAll(SEL.profileLink)) {
      const key = profileKey(link);
      if (people.has(key)) continue;
      const person = readPerson(personCard(link, section));
      if (person) people.set(key, { ...person, profileUrl: key });
      if (people.size === MAX_CONTACTS) break;
    }
    return Array.from(people.values());
  }

  /**
   * The element holding one person's lines. The SDUI profile link holds them
   * all itself; the classic layout's name link doesn't, so climb to the
   * person's card, stopping short of other people and of the section headings.
   */
  function personCard(link, section) {
    const lineCount = (el) => el.innerText.split("\n").filter((l) => l.trim()).length;
    let card = link;
    while (lineCount(card) < 2 && card.parentElement && card.parentElement !== section) {
      const parent = card.parentElement;
      const profiles = new Set(Array.from(parent.querySelectorAll(SEL.profileLink), profileKey));
      if (profiles.size > 1 || parent.querySelector("h1, h2, h3, h4")) break;
      card = parent;
    }
    return card;
  }

  /** "Name / • 3rd / Headline / Job poster" → { name, degree, headline, note }, or null. */
  function readPerson(card) {
    const lines = card.innerText
      .split("\n")
      .map((line) => clean(line))
      .filter((line) => line && !BUTTON_LINE.test(line) && !PEOPLE_HEADING.test(line));
    const [first = "", ...rest] = lines;
    // The degree is its own line in the SDUI layout, and trails the name ("Ann Lee • 2nd") in the classic one.
    const inline = first.match(DEGREE_SUFFIX);
    const at = rest.findIndex((line) => DEGREE.test(line));
    const degree = inline?.[1] ?? (at >= 0 ? rest.splice(at, 1)[0].replace(/^[•·]\s*/, "") : "");
    const name = first
      .replace(DEGREE_SUFFIX, "")
      .replace(/^[\s.•·\-_|/]+/, "")
      .trim();
    return name ? { name, degree, headline: rest[0] ?? "", note: rest.slice(1).join(" · ") } : null;
  }

  // ── Header facts ───────────────────────────────────────────────────────────

  /** "London Area, United Kingdom · 3 weeks ago · …": the first segment of the header's meta line. */
  function jobLocation() {
    const line = summaryText().split("\n").find((l) => l.includes(" · ")) ?? "";
    const first = line.split(" · ")[0].trim();
    return /\bago\b|applicant/i.test(first) ? "" : first;
  }

  /** The open job's header (location · posted · applicants, workplace, type), for quick facts. */
  function summaryText() {
    if (layout() === "A") return document.querySelector(SEL.topCard)?.innerText ?? "";
    let node = anchor()?.el ?? null;
    for (let depth = 0; node && depth < 10; depth++, node = node.parentElement) {
      // The header block holds "location · posted · applicants" and the workplace/type chips above Apply.
      const text = node.innerText ?? "";
      if (text.includes(" · ") && /\bapply\b/i.test(text)) return text.slice(0, 1500);
    }
    return "";
  }

  JT.register({
    name: "linkedin",
    summaryText,
    location: jobLocation,
    host: /(^|\.)linkedin\.com$/,
    // The script runs site-wide so it's present when LinkedIn navigates into jobs without a reload.
    activeOn: (path) => path.startsWith("/jobs") || path.startsWith("/comm/jobs"),
    job,
    contacts,
    /** A job is open but the pane is still switching to it; keep the bar as it is meanwhile. */
    settling: () => {
      const id = jobId();
      return Boolean(id) && !paneReady(id, layout());
    },
    applyControl,
    anchor,
  });
})();
