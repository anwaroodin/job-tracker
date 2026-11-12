const THEMES = ["light", "dark", "system"];
const KEY = "theme";

const pick = (theme) => (THEMES.includes(theme) ? theme : "light");

export async function getTheme() {
  const { [KEY]: theme } = await chrome.storage.sync.get(KEY);
  return pick(theme);
}

export const setTheme = (theme) => chrome.storage.sync.set({ [KEY]: pick(theme) });

export async function applyTheme() {
  document.documentElement.dataset.theme = await getTheme();
  chrome.storage.sync.onChanged.addListener((changes) => {
    if (changes[KEY]) document.documentElement.dataset.theme = pick(changes[KEY].newValue);
  });
}
