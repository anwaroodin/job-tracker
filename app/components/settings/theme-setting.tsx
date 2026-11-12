import { useState } from "react";
import { useRevalidator, useRouteLoaderData } from "react-router";
import { Segmented } from "~/components/ui/segmented";
import { saveThemeCookie, type Theme } from "~/lib/theme";
import type { loader as rootLoader } from "~/root";
import { Setting } from "./setting-row";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function ThemeSetting() {
  const saved = useRouteLoaderData<typeof rootLoader>("root")?.theme ?? "light";
  const [theme, setTheme] = useState<Theme>(saved);
  const revalidator = useRevalidator();

  return (
    <Setting label="Theme" description="Saved on this device. System follows your computer's light or dark setting.">
      <Segmented
        label="Theme"
        options={OPTIONS}
        value={theme}
        onChange={(next) => {
          setTheme(next);
          saveThemeCookie(next);
          revalidator.revalidate();
        }}
      />
    </Setting>
  );
}
