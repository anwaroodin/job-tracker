/**
 * Form filling: recognises application fields and fills them from profile
 * values. Never overwrites a value and never fills the same control twice.
 */
(() => {
  "use strict";

  const JT = globalThis.__jobTracker;
  if (!JT || JT.fillForm) return;
  const { clean, isVisible } = JT.dom;

  // ── Field detection ──────────────────────────────────────────────────────

  /**
   * Field kinds decide which controls a field may fill:
   * text → single-line inputs and selects, long → textareas and rich text,
   * bool → radios, checkboxes and yes/no selects.
   */
  const FIELDS = [
    ["email", "text", [/e[\s_-]?mail/i]],
    ["fullName", "text", [/full[\s_-]?name/i, /^\s*(your\s+|legal\s+)?name\s*\*?\s*$/i]],
    ["firstName", "text", [/first[\s_-]?name/i, /given[\s_-]?name/i, /forename/i, /(?:^|[\W_])fname\b/i]],
    ["lastName", "text", [/last[\s_-]?name/i, /surname/i, /family[\s_-]?name/i, /(?:^|[\W_])lname\b/i]],
    ["phone", "text", [/phone/i, /mobile/i, /telephone/i, /\btel\b/i, /contact[\s_-]?number/i]],
    ["linkedin", "text", [/linked[\s_-]?in/i]],
    ["github", "text", [/git[\s_-]?hub/i]],
    ["portfolio", "text", [/portfolio/i, /\bwebsite\b/i, /personal[\s_-]?(site|url)/i]],
    ["rightToWork", "bool", [/right[\s_-]?to[\s_-]?work/i, /(eligible|authori[sz]ed|entitled|legally able)\b.*\bwork/i, /work[\s_-]?(authori[sz]ation|permit)/i]],
    ["requiresSponsorship", "bool", [/sponsor/i]],
    ["noticePeriod", "text", [/notice[\s_-]?period/i, /when\s+can\s+you\s+start/i, /(earliest|available)[\s_-]?start/i, /start[\s_-]?date/i]],
    ["salary", "text", [/salary/i, /compensation/i, /pay[\s_-]?expectation/i, /desired[\s_-]?pay/i]],
    ["coverLetter", "long", [/cover[\s_-]?letter/i, /(supporting|personal)[\s_-]?statement/i, /motivation/i, /why\s+(do|are|would)\s+you/i, /why\s+.*\s+(us|role|company|position)\b/i, /about\s+yourself/i]],
    ["summary", "long", [/\bsummary\b/i, /\bprofile\b/i, /\bobjective\b/i, /\bbio\b/i, /about[\s_-]?me/i]],
    ["addressLine1", "text", [/address[\s_-]?(line[\s_-]?)?1/i, /street/i, /^\s*(home\s+)?address\s*\*?\s*$/i]],
    ["addressLine2", "text", [/address[\s_-]?(line[\s_-]?)?2/i, /apartment/i, /\bapt\b/i, /\bsuite\b/i]],
    ["postcode", "text", [/post[\s_-]?code/i, /\bzip\b/i, /postal/i]],
    ["city", "text", [/\bcity\b/i, /\btown\b/i]],
    ["county", "text", [/\bcounty\b/i, /\bprovince\b/i, /^\s*state\s*\*?\s*$/i]],
    ["country", "text", [/\bcountry\b/i]],
  ];

  const AUTOCOMPLETE = {
    "given-name": "firstName",
    "family-name": "lastName",
    name: "fullName",
    email: "email",
    tel: "phone",
    "tel-national": "phone",
    "address-line1": "addressLine1",
    "street-address": "addressLine1",
    "address-line2": "addressLine2",
    "address-level2": "city",
    "address-level1": "county",
    "postal-code": "postcode",
    country: "country",
    "country-name": "country",
  };

  const KIND_OF = Object.fromEntries(FIELDS.map(([field, kind]) => [field, kind]));

  const TEXT_INPUT_TYPES = new Set(["", "text", "email", "tel", "url", "number"]);

  /** Which field kinds a control can hold. */
  function kindsFor(el) {
    if (el instanceof HTMLSelectElement) return ["text", "bool"];
    if (el instanceof HTMLTextAreaElement) return ["long", "text"];
    if (el instanceof HTMLInputElement) {
      if (el.type === "radio" || el.type === "checkbox") return ["bool"];
      return TEXT_INPUT_TYPES.has(el.type) ? ["text"] : [];
    }
    return el.isContentEditable ? ["long"] : [];
  }

  const byIds = (ids) =>
    (ids ?? "")
      .split(/\s+/)
      .map((id) => id && document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" ");

  /** The question a radio or checkbox answers, rather than its own "Yes"/"No" label. */
  function groupQuestion(el) {
    const legend = el.closest("fieldset")?.querySelector("legend")?.textContent;
    if (legend) return legend;
    const group = el.closest('[role="radiogroup"], [role="group"]');
    if (group) return group.getAttribute("aria-label") || byIds(group.getAttribute("aria-labelledby"));
    let node = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      for (const label of node.querySelectorAll("label, legend, p, h3, h4, [class*='label'], [class*='question']")) {
        if (label.contains(el) || label.control?.type === el.type) continue;
        const text = clean(label.textContent);
        if (text.length > 3) return text;
      }
    }
    return "";
  }

  /** Descriptions of a control, most specific first. */
  function descriptors(el) {
    const labels = [
      ...Array.from(el.labels ?? [], (l) => l.textContent),
      el.getAttribute("aria-label"),
      byIds(el.getAttribute("aria-labelledby")),
      el.getAttribute("placeholder"),
    ].filter(Boolean);
    const attrs = [
      el.getAttribute("name"),
      el.id,
      el.getAttribute("data-automation-id"),
      el.getAttribute("data-qa"),
    ];

    let described;
    if (el.type === "radio") described = [groupQuestion(el)];
    else if (el.type === "checkbox") described = labels.length ? labels : [groupQuestion(el)];
    else described = [...labels, el.previousElementSibling?.textContent];

    return [...described, ...attrs].map((d) => clean(d, 200)).filter(Boolean);
  }

  function fieldFor(el) {
    const kinds = kindsFor(el);
    if (!kinds.length) return null;
    const auto = AUTOCOMPLETE[(el.getAttribute("autocomplete") ?? "").split(/\s+/).pop()];
    if (auto && kinds.includes(KIND_OF[auto])) return auto;
    for (const text of descriptors(el)) {
      for (const [field, kind, patterns] of FIELDS) {
        if (kinds.includes(kind) && patterns.some((p) => p.test(text))) return field;
      }
    }
    return null;
  }

  // ── Filling ──────────────────────────────────────────────────────────────

  const YES = /^(yes|y|true|1)\b|\bi (do|am|have|can)\b(?! not)/i;
  const NO = /^(no|n|false|0)\b|\bi (do not|don't|am not|have not|cannot|can't)\b/i;
  const PLACEHOLDER_OPTION = /^(select|choose|please|--|—|-)|^$/i;

  /**
   * Sets a value through the prototype setter so React, Vue and similar
   * frameworks see the change, then fires the events they listen for.
   */
  function setValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("blur"));
  }

  const optionLabel = (option) => clean(option.textContent || option.value).toLowerCase();

  function selectHasAnswer(select) {
    const option = select.selectedOptions[0];
    return Boolean(option && option.value && !PLACEHOLDER_OPTION.test(optionLabel(option)));
  }

  function pickOption(select, test) {
    const option = Array.from(select.options).find(
      (o) => !o.disabled && o.value && !PLACEHOLDER_OPTION.test(optionLabel(o)) && test(optionLabel(o), o.value.toLowerCase()),
    );
    if (!option) return false;
    setValue(select, option.value);
    return true;
  }

  function fillSelect(select, value) {
    const wanted = String(value).toLowerCase().trim();
    return (
      pickOption(select, (label, val) => label === wanted || val === wanted) ||
      pickOption(select, (label) => label.length > 2 && (label.includes(wanted) || wanted.includes(label)))
    );
  }

  const answerMatches = (text, answer) => (answer ? YES.test(text) : NO.test(text) && !YES.test(text));

  function radioGroup(radio) {
    const scope = radio.form?.elements ?? document.getElementsByName(radio.name);
    return Array.from(scope).filter((el) => el.type === "radio" && el.name === radio.name);
  }

  function fillRadio(radio, answer) {
    const group = radio.name ? radioGroup(radio) : [radio];
    if (group.some((r) => r.checked)) return false;
    const match = group.find((r) => {
      const label = clean([...Array.from(r.labels ?? [], (l) => l.textContent), r.getAttribute("aria-label"), r.value].join(" "));
      return answerMatches(label, answer);
    });
    if (!match || match.disabled) return false;
    match.click();
    return true;
  }

  function fillBool(el, answer) {
    if (typeof answer !== "boolean") return false;
    if (el instanceof HTMLSelectElement) {
      return !selectHasAnswer(el) && pickOption(el, (label) => answerMatches(label, answer));
    }
    if (el.type === "radio") return fillRadio(el, answer);
    // A lone checkbox states something is true ("I have the right to work"); only tick it.
    if (el.type === "checkbox" && answer && !el.checked) {
      el.click();
      return true;
    }
    return false;
  }

  function fillText(el, value) {
    if (el instanceof HTMLSelectElement) return !selectHasAnswer(el) && fillSelect(el, value);
    if (el.isContentEditable && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      if (el.textContent.trim()) return false;
      el.textContent = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    if (el.value.trim()) return false;
    const next = el.type === "number" ? value.replace(/[^\d.]/g, "") : value;
    if (!next) return false;
    setValue(el, next);
    return true;
  }

  const CONTROLS = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
  /** Site chrome such as search bars, which share labels like "City" with application forms. */
  const SITE_CHROME = "header, nav, [role='search'], [role='banner'], [role='navigation'], [class*='search-box'], [class*='searchbox']";

  /** When a dialog with form controls is open (LinkedIn Easy Apply, Indeed), only fill inside it. */
  function fillScope(dialogOnly) {
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'], [aria-modal='true'], dialog[open]"));
    return dialogs.find((d) => isVisible(d) && d.querySelector(CONTROLS)) ?? (dialogOnly ? null : document);
  }

  /** Controls this world has filled; they're never filled again, so clearing one sticks. */
  const touched = new WeakSet();

  function candidates(dialogOnly = false) {
    const scope = fillScope(dialogOnly);
    if (!scope) return [];
    const seenGroups = new Set();
    const out = [];
    for (const el of scope.querySelectorAll(CONTROLS)) {
      if (touched.has(el) || el.disabled || el.readOnly || !isVisible(el)) continue;
      if (el.closest(SITE_CHROME) && !el.closest("form:not([role='search'])")) continue;
      if (el.type === "radio" && el.name) {
        if (seenGroups.has(el.name)) continue;
        seenGroups.add(el.name);
      }
      const field = fieldFor(el);
      if (field) out.push([el, field]);
    }
    return out;
  }

  /** How many recognised application fields the page has; used to spot real forms in iframes. */
  const countFields = () => candidates().length;

  /**
   * Fills recognised fields with the given values. Fields that already have
   * a value, answered radio groups and chosen select options are left alone.
   * @param {Record<string, string | boolean>} values
   */
  function fillForm(values, { dialogOnly = false } = {}) {
    let filled = 0;
    for (const [el, field] of candidates(dialogOnly)) {
      const value = values?.[field];
      if (value === undefined || value === null || value === "") continue;
      try {
        const done = KIND_OF[field] === "bool" ? fillBool(el, value) : fillText(el, String(value));
        if (done) {
          touched.add(el);
          filled++;
        }
      } catch {
        // A page script may throw from its own listeners; keep filling the rest.
      }
    }
    return { filled };
  }

  Object.assign(JT, { countFields, fillForm });
})();
