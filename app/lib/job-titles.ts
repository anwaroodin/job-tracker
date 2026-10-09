const shortTitle = (role: string) => role.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").split(/\s[-–—|,]\s/)[0].replace(/\s+/g, " ").trim();

const titleWords = (role: string) =>
  shortTitle(role)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}+#.]/gu, ""))
    .filter(Boolean);

function joinCompounds(words: string[], vocabulary: Set<string>) {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const joined = words[i] + (words[i + 1] ?? "");
    if (i + 1 < words.length && vocabulary.has(joined)) {
      out.push(joined);
      i++;
    } else out.push(words[i]);
  }
  return new Set(out);
}

const within = (inner: Set<string>, outer: Set<string>) => [...inner].every((w) => outer.has(w));

export function groupByRole<T extends { role: string }>(items: T[]) {
  const vocabulary = new Set(items.flatMap((item) => titleWords(item.role)));
  const titled = items
    .map((item) => ({ item, title: shortTitle(item.role), words: joinCompounds(titleWords(item.role), vocabulary) }))
    .sort((a, b) => a.words.size - b.words.size || a.title.length - b.title.length);

  const groups: { role: string; words: Set<string>; items: T[] }[] = [];
  for (const { item, title, words } of titled) {
    const home = groups.find((g) => (g.words.size >= 2 || g.words.size === words.size) && within(g.words, words));
    if (home) home.items.push(item);
    else groups.push({ role: title, words, items: [item] });
  }
  return groups.sort((a, b) => b.items.length - a.items.length || a.role.localeCompare(b.role));
}
