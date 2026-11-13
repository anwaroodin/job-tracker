export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

const COOKIE = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export const COLOR_SCHEMES: Record<Theme, string> = { light: "light", dark: "dark", system: "light dark" };

export const THEME_FROM_COOKIE_SCRIPT = `(() => {
  const theme = document.cookie.match(/(?:^|;\\s*)${COOKIE}=(${THEMES.join("|")})/)?.[1];
  if (theme) document.documentElement.dataset.theme = theme;
})();`;

export function themeFromCookie(header: string | null): Theme {
  const value = header?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  return THEMES.find((t) => t === value) ?? "light";
}

export function saveThemeCookie(theme: Theme) {
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
