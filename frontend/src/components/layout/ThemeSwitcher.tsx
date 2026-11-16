import { Monitor, Moon, Sun } from "lucide-react";
import { usePrefs, type ThemePref } from "@/app/theme";
import { Segmented } from "@/components/common/Segmented";

export const THEME_OPTIONS = [
  { value: "light" as ThemePref, label: "Light", icon: Sun },
  { value: "dark" as ThemePref, label: "Dark", icon: Moon },
  { value: "system" as ThemePref, label: "System", icon: Monitor },
];

export function ThemeSwitcher({ hideLabels, className }: { hideLabels?: boolean; className?: string }) {
  const { theme, setTheme } = usePrefs();
  return <Segmented label="Theme" value={theme} onChange={setTheme} options={THEME_OPTIONS} hideLabels={hideLabels} className={className} />;
}
