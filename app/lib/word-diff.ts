export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.match(/\S+/g) ?? [];
  const b = after.match(/\S+/g) ?? [];
  const common = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] = a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], word: string) => {
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += ` ${word}`;
    else parts.push({ kind, text: word });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (common[i + 1][j] >= common[i][j + 1]) push("removed", a[i++]);
    else push("added", b[j++]);
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return parts;
}
