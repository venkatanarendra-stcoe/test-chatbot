import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { usePrefs } from "@/app/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssistantProvider } from "@/features/assistant/AssistantProvider";
import { ChatLauncher } from "@/features/assistant/ChatLauncher";
import { ChatPanel } from "@/features/assistant/ChatPanel";
import { useIsMobile, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { HelpDialog } from "./HelpDialog";
import { MobileBottomNav, MobileTopBar } from "./MobileNav";
import { SettingsDialog } from "./SettingsDialog";
import { ShellContext } from "./shell";
import { Sidebar } from "./Sidebar";

const KEY = "sidebar-collapsed";
const readOverride = (): boolean | null => { try { const v = localStorage.getItem(KEY); return v === "1" ? true : v === "0" ? false : null; } catch { return null; } };

/** Fixed-height shell: the sidebar, top bar and bottom nav never scroll; only the content pane may. */
export function AppShell() {
  const mobile = useIsMobile();
  const wide = useMediaQuery("(min-width: 1280px)");
  const { sidebar } = usePrefs();
  const [override, setOverride] = useState<boolean | null>(readOverride);
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);

  // Changing the default in Settings takes effect immediately.
  useEffect(() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setOverride(null); }, [sidebar]);

  const defaultCollapsed = sidebar === "collapsed" || (sidebar === "auto" && !wide);
  const collapsed = override ?? defaultCollapsed;
  const toggle = useCallback(() => {
    const next = !collapsed;
    setOverride(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  const shell = useMemo(() => ({ openSettings: () => setSettings(true), openHelp: () => setHelp(true) }), []);

  return (
    <TooltipProvider delayDuration={150}>
      <ShellContext.Provider value={shell}>
        <AssistantProvider>
          <div className="flex h-dvh overflow-hidden bg-background">
            {!mobile && (
              <aside aria-label="Sidebar" className={cn("shrink-0 border-r border-border transition-[width] duration-200 ease-out", collapsed ? "w-[72px]" : "w-64")}>
                <Sidebar collapsed={collapsed} onToggle={toggle} />
              </aside>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              {mobile && <MobileTopBar />}
              <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 scrollbar-thin lg:p-6" id="main">
                <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col"><Outlet /></div>
              </main>
              {mobile && <MobileBottomNav />}
            </div>
          </div>
          <ChatPanel />
          <ChatLauncher />
          <SettingsDialog open={settings} onOpenChange={setSettings} />
          <HelpDialog open={help} onOpenChange={setHelp} />
        </AssistantProvider>
      </ShellContext.Provider>
    </TooltipProvider>
  );
}
