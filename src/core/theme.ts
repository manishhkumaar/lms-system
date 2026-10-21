import { useSyncExternalStore } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "batch-lms:theme";
const listeners = new Set<() => void>();

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function setTheme(t: ThemeChoice) {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  listeners.forEach((l) => l());
}

export function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTheme,
    getTheme,
  );
  return [t, setTheme];
}
