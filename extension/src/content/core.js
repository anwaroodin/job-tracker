/**
 * Content-script core, loaded first. Creates the shared namespace
 * (globalThis.__jobTracker) with DOM helpers, structured-data readers and the
 * site adapter registry. Adapters, capture, fill and main.js build on it.
 *
 * Content scripts are classic scripts, so each file is an IIFE that reads
 * what it needs from the namespace and adds its own exports to it.
 */
(() => {
  "use strict";

  if (globalThis.__jobTracker) return;

  const LIMITS = { company: 100, role: 150, description: 20_000 };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clean = (value, max = 500) =>
    String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

  const cleanBlock = (value, max) =>
    String(value ?? "")
      .replace(/[ \t\f\v ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, max);

  const isVisible = (el) => Boolean(el) && el.getClientRects().length > 0;

  const visible = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector)).find(isVisible) ?? null;

  const visibleText = (selector) => clean(visible(selector)?.innerText);

  const meta = (key) =>
    clean(
      document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute("content"),
    );

  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

  /**
   * Strips tags from JSON-LD descriptions. Parsing HTML (DOMParser,
   * innerHTML) is blocked on pages that enforce Trusted Types, such as Google.
   */
  const htmlToText = (html) =>
    String(html)
      .replace(/<(p|div)\b[^>]*>\s*<(strong|b)\b[^>]*>([^<]{1,80})<\/\2>\s*<\/\1>/gi, "\n\n## $3\n")
      .replace(/<h[1-6]\b[^>]*>/gi, "\n\n## ")
      .replace(/<(br|\/p|\/li|\/div|\/h\d|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, "")
      .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code) => {
        if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? match;
        const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      });

  const BLOCK_TAGS = /^(DIV|P|LI|BR|H[1-6]|UL|OL|TR|SECTION)$/;

  /** Text of an element including hidden parts, with line breaks between blocks. */
  function blockText(root, skip) {
    let out = "";
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (skip?.contains(node)) continue;
      if (node.nodeType === Node.TEXT_NODE) out += node.data;
      else if (BLOCK_TAGS.test(node.tagName)) out += "\n";
    }
    return out;
  }

  const HEADING_MAX = 80;
  const SKIP_TAGS = /^(script|style|noscript|template|button|svg|img|input|select|textarea)$/;
  const BOLD_TAGS = /^(STRONG|B)$/;
  /** Nothing visible: no node, whitespace, or a comment (framework markup is full of them). */
  const isBlank = (node) =>
    !node || node.nodeType === Node.COMMENT_NODE || (node.nodeType === Node.TEXT_NODE && !node.data.trim());

  /** A <strong> alone on its line: nothing but line breaks or the block's edges around it. */
  function boldLine(el) {
    if (!BOLD_TAGS.test(el.tagName)) return false;
    const aloneBefore = (n) => isBlank(n) ? !n || aloneBefore(n.previousSibling) : n.tagName === "BR";
    const aloneAfter = (n) => isBlank(n) ? !n || aloneAfter(n.nextSibling) : n.tagName === "BR";
    return aloneBefore(el.previousSibling) && aloneAfter(el.nextSibling);
  }

  /** A paragraph whose only text is bold, the way most listings mark their section headings. */
  function boldBlock(el) {
    if (!/^(P|DIV)$/.test(el.tagName) || el.childElementCount === 0) return false;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.data.trim() && !node.parentElement.closest("strong, b")) return false;
    }
    return true;
  }

  /**
   * The text of an element that reads as a section heading (h1–h6, or a short
   * line that's entirely bold), or "". Cheap checks come first: most elements
   * are ruled out by their tag before any text is read.
   */
  function headingText(el) {
    const candidate = /^H[1-6]$/.test(el.tagName) || boldBlock(el) || boldLine(el);
    if (!candidate) return "";
    const text = clean(el.textContent);
    return text.length <= HEADING_MAX ? text : "";
  }

  /**
   * A listing's visible text with its structure kept as light markup: "## "
   * before headings (h1–h6 and bold-only lines) and "• " before list items,
   * so the dashboard can lay the description out like the original posting.
   */
  function richText(root) {
    let out = "";
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.data.replace(/\s+/g, " ");
          continue;
        }
        if (child.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.test(child.localName)) continue;
        // Not checkVisibility(): it reports `display: contents` wrappers (LinkedIn's
        // description sits in one) as hidden, which would drop everything inside.
        const style = getComputedStyle(child);
        if (style.display === "none" || style.visibility === "hidden" || child.getAttribute("aria-hidden") === "true") continue;
        const tag = child.tagName;
        const heading = headingText(child);
        if (tag === "BR") out += "\n";
        else if (tag === "LI") {
          out += "\n• ";
          walk(child);
          out += "\n";
        } else if (heading) {
          out += `\n\n## ${heading}\n`;
        } else if (BLOCK_TAGS.test(tag)) {
          out += "\n";
          walk(child);
          out += "\n";
        } else walk(child);
      }
    };
    walk(root);
    return out;
  }

  const titleCase = (slug) =>
    slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const httpUrl = (href) => {
    if (typeof href !== "string" || !href.trim()) return "";
    try {
      const url = new URL(href, location.href);
      return /^https?:$/.test(url.protocol) ? url.toString() : "";
    } catch {
      return "";
    }
  };

  // ── Structured data ──────────────────────────────────────────────────────

  /** A schema.org JobPosting from the page's JSON-LD, the most reliable source when present. */
  function jsonLdJob() {
    const stack = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        stack.push(JSON.parse(script.textContent));
      } catch {
        // Malformed JSON-LD is common; skip it.
      }
    }
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      const types = [].concat(node["@type"] ?? []);
      if (types.includes("JobPosting")) {
        const org = node.hiringOrganization;
        const logo = org?.logo;
        return {
          role: clean(node.title),
          company: clean(typeof org === "string" ? org : org?.name),
          logo: httpUrl(typeof logo === "string" ? logo : logo?.url),
          description: node.description ? htmlToText(node.description) : "",
          url: httpUrl(node.url),
        };
      }
      if (node["@graph"]) stack.push(node["@graph"]);
    }
    return null;
  }

  function microdataJob() {
    const root = document.querySelector('[itemtype*="schema.org/JobPosting"]');
    if (!root) return null;
    const org = root.querySelector('[itemprop="hiringOrganization"]');
    const description = root.querySelector('[itemprop="description"]');
    const logo = org?.querySelector('[itemprop="logo"]');
    return {
      logo: httpUrl(logo?.getAttribute("content") || logo?.getAttribute("src") || logo?.getAttribute("href")),
      role: clean(root.querySelector('[itemprop="title"]')?.textContent),
      company: clean(
        org?.querySelector('[itemprop="name"]')?.textContent ||
          org?.getAttribute("content") ||
          org?.textContent,
      ),
      description: description ? richText(description) : "",
    };
  }

  /**
   * Site adapters, registered by src/content/adapters/*.js. Contract:
   * { name, host: RegExp, activeOn?(path): boolean, job(): Job | null,
   *   settling?(): boolean, contacts?(): Contact[], applyControl(): Element | null,
   *   anchor?(): { el, where, block?, fill? } | null }
   * `where` is an insertAdjacentElement position; "beforeend" with `fill`
   * appends the bar to a flex row and stretches that row so the bar sits at its right end.
   * `settling` is true while an SPA is mid-switch between jobs (job() returns null then).
   * See extension/README.md.
   */
  const adapters = [];
  const register = (adapter) => adapters.push(adapter);

  globalThis.__jobTracker = {
    LIMITS,
    dom: { clean, cleanBlock, isVisible, visible, visibleText, meta, htmlToText, blockText, richText, titleCase, httpUrl },
    structured: { jsonLdJob, microdataJob },
    adapters,
    register,
  };
})();
