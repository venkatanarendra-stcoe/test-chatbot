import { NavLink, useLocation } from "react-router-dom";
import { HelpCircle, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, Sun, type LucideIcon } from "lucide-react";
import { usePrefs } from "@/app/theme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { BRAND, navFor } from "./nav";
import { useShell } from "./shell";
import { THEME_OPTIONS, ThemeSwitcher } from "./ThemeSwitcher";
import { UserMenu } from "./UserMenu";

export function BrandMark({ className }: { className?: string }) {
  return <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)}><ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden /></div>;
}

const itemCls = "relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FooterItem({ icon: Icon, label, onClick, collapsed, testId }: { icon: LucideIcon; label: string; onClick: () => void; collapsed: boolean; testId?: string }) {
  const btn = (
    <button type="button" onClick={onClick} aria-label={label} data-testid={testId} className={cn(itemCls, collapsed && "justify-center px-0")}>
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />{!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
  return collapsed ? <Tooltip><TooltipTrigger asChild>{btn}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip> : btn;
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { openSettings, openHelp } = useShell();
  const { theme, setTheme } = usePrefs();
  const groups = navFor(user?.role);
  const ThemeIcon = THEME_OPTIONS.find((o) => o.value === theme)?.icon ?? Sun;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className={cn("flex h-14 shrink-0 items-center gap-3 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <BrandMark />
        {!collapsed && <span className="truncate text-base font-semibold tracking-tight text-text">{BRAND}</span>}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Main">
        {groups.map((g, gi) => (
          <div key={g.title} className={cn(gi > 0 && "mt-5")}>
            {collapsed
              ? gi > 0 && <div className="mx-2 mb-2 border-t border-border" aria-hidden />
              : <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-[0.04em] text-text-muted">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/");
                const link = (
                  <NavLink to={it.to} end={it.end} data-testid={`nav-${it.id}`} aria-label={collapsed ? it.label : undefined} aria-current={active ? "page" : undefined}
                    className={cn(itemCls, collapsed && "justify-center px-0", active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary")}>
                    {active && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r-full bg-primary" aria-hidden />}
                    <it.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                  </NavLink>
                );
                return <li key={it.to}>{collapsed ? <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{it.label}</TooltipContent></Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border p-3">
        {collapsed ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild><DropdownMenuTrigger asChild><button type="button" aria-label="Theme" className={cn(itemCls, "justify-center px-0")}><ThemeIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden /></button></DropdownMenuTrigger></TooltipTrigger>
              <TooltipContent side="right">Theme</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="end" className="w-40">
              {THEME_OPTIONS.map((o) => <DropdownMenuItem key={o.value} onSelect={() => setTheme(o.value)}><o.icon /> {o.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : <ThemeSwitcher className="mb-2" />}
        <FooterItem icon={Settings} label="Settings" onClick={openSettings} collapsed={collapsed} testId="nav-settings" />
        <FooterItem icon={HelpCircle} label="Help" onClick={openHelp} collapsed={collapsed} testId="nav-help" />
        <FooterItem icon={collapsed ? PanelLeftOpen : PanelLeftClose} label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggle} collapsed={collapsed} testId="sidebar-toggle" />
        <div className="mt-1 border-t border-border pt-2"><UserMenu collapsed={collapsed} /></div>
      </div>
    </div>
  );
}

