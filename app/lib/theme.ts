export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];

const COOKIE = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function themeFromCookie(header: string | null): Theme {
  const value = header?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  return THEMES.find((t) => t === value) ?? "dark";
}

export function saveThemeCookie(theme: Theme) {
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
