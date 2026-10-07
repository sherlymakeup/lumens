import type { FontSize, ThemeMode } from "./types";

export function resolveDark(theme: ThemeMode) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const dark = resolveDark(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fontSize = size;
}

export function applyDensity(density: "comfortable" | "compact") {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = density;
}
