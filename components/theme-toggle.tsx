"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label = theme === "light" ? "Claro" : theme === "dark" ? "Escuro" : "Automático";

  return (
    <button className="icon-button" type="button" onClick={() => setTheme(next)} aria-label={`Tema atual: ${label}`}>
      {theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐"}
    </button>
  );
}
