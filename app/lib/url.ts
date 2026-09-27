/** A URL's hostname without a leading "www.", or "" when it doesn't parse. */
export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
