/**
 * Picks the CV variant and category for a job from its title and
 * description. Title matches count more than description matches.
 */

const CV_KEYWORDS = {
  software: [
    "software", "developer", "engineer", "engineering", "frontend", "front-end",
    "backend", "back-end", "full stack", "full-stack", "devops", "data",
    "programmer", "typescript", "javascript", "python", "java", "react",
    "cloud", "machine learning", "qa", "test automation", "it support",
  ],
  retail: [
    "retail", "sales assistant", "store", "shop", "customer assistant",
    "cashier", "barista", "warehouse", "stock", "merchandis", "hospitality",
    "waiter", "waitress", "kitchen", "crew member", "team member", "supermarket",
    "customer service", "front of house", "delivery driver",
  ],
};

const CATEGORY_PATTERNS = {
  intern: /\b(intern(ship)?|placement|industrial year|year in industry)\b/i,
  grad: /\b(grad(uate)?|early careers?|new grad|entry[- ]level)\b/i,
  junior: /\b(junior|jr\.?|associate)\b/i,
};

const count = (text, word) => text.split(word).length - 1;

export function detectCvType({ role = "", description = "" }) {
  const title = role.toLowerCase();
  const body = description.toLowerCase().slice(0, 8000);
  const score = (words) =>
    words.reduce((sum, w) => sum + count(title, w) * 5 + Math.min(count(body, w), 3), 0);
  return score(CV_KEYWORDS.retail) > score(CV_KEYWORDS.software) ? "retail" : "software";
}

/** Only the title is used: descriptions mention "graduate" or "junior" too loosely. */
export function detectCategory({ role = "" }) {
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(role)) return category;
  }
  return "";
}
