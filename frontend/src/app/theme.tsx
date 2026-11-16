import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type SidebarDefault = "auto" | "expanded" | "collapsed";

interface Prefs { theme: ThemePref; density: Density; sidebar: SidebarDefault }
interface Ctx extends Prefs {
  resolved: "light" | "dark";
  setTheme: (t: ThemePref) => void;
  setDensity: (d: Density) => void;
  setSidebar: (s: SidebarDefault) => void;
}

const KEY = "prefs";
const DEFAULTS: Prefs = { theme: "light", density: "comfortable", sidebar: "auto" };
const THEMES: ThemePref[] = ["light", "dark", "system"];

function load(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs>;
    return {
      theme: THEMES.includes(p.theme as ThemePref) ? (p.theme as ThemePref) : DEFAULTS.theme,
      density: p.density === "compact" ? "compact" : "comfortable",
      sidebar: p.sidebar === "expanded" || p.sidebar === "collapsed" ? p.sidebar : "auto",
    };
  } catch { return DEFAULTS; }
}

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSysDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved = prefs.theme === "system" ? (sysDark ? "dark" : "light") : prefs.theme;
  useEffect(() => { document.documentElement.classList.toggle("dark", resolved === "dark"); }, [resolved]);

  const update = useCallback((patch: Partial<Prefs>) => setPrefs((p) => {
    const next = { ...p, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  }), []);

  const value = useMemo<Ctx>(() => ({
    ...prefs, resolved,
    setTheme: (theme) => update({ theme }), setDensity: (density) => update({ density }), setSidebar: (sidebar) => update({ sidebar }),
  }), [prefs, resolved, update]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function usePrefs() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("usePrefs must be used inside ThemeProvider");
  return c;
}
