import { getDashboardOrigin } from "../config.js";

export function isNewer(latest, current) {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff) return diff > 0;
  }
  return false;
}

let prompting = null;

export async function promptUpdate(res) {
  const latest = res.headers.get("X-Extension-Latest");
  const current = chrome.runtime.getManifest().version;
  if (!latest || !isNewer(latest, current) || prompting === latest) return;
  prompting = latest;
  const { updatePrompted } = await chrome.storage.local.get("updatePrompted");
  if (updatePrompted === latest) return;
  await chrome.storage.local.set({ updatePrompted: latest });
  const origin = await getDashboardOrigin();
  if (origin) await chrome.tabs.create({ url: `${origin}/extension?from=${encodeURIComponent(current)}` });
}
