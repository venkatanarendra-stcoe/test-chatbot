import { usePrefs } from "@/app/theme";

/** Resolved theme plus a toggle between light and dark. */
export function useTheme() {
  const { resolved, setTheme } = usePrefs();
  return { theme: resolved, toggle: () => setTheme(resolved === "dark" ? "light" : "dark") };
}
