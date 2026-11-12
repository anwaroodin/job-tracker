import { useEffect, useState } from "react";

export function useShortcutLabel() {
  const [label, setLabel] = useState("Ctrl+K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setLabel("⌘K");
  }, []);
  return label;
}
