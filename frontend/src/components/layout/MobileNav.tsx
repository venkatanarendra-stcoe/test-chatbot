import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { HelpCircle, LogOut, MoreHorizontal, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { BRAND, MOBILE_PRIMARY, navFor, routeTitle } from "./nav";
import { useShell } from "./shell";
import { BrandMark } from "./Sidebar";
import { ThemeSwitcher } from "./ThemeSwitcher";

const tab = "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-micro font-medium text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

export function MobileTopBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <BrandMark className="h-7 w-7" />
      <span className="sr-only">{BRAND}</span>
      <h2 className="truncate text-base font-semibold text-text">{routeTitle(pathname, user?.role)}</h2>
    </header>
  );
}

export function MobileBottomNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { openSettings, openHelp } = useShell();
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const role = user?.role === "admin" ? "admin" : "customer";
  const all = navFor(role).flatMap((g) => g.items);
  const primary = MOBILE_PRIMARY[role].map((id) => all.find((i) => i.id === id)!);
  const rest = all.filter((i) => !MOBILE_PRIMARY[role].includes(i.id));
  const moreActive = rest.some((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  const act = (fn: () => void) => () => { setMore(false); fn(); };

  return (
    <>
      <nav aria-label="Main" className="pb-safe shrink-0 border-t border-border bg-surface">
        <div className="flex h-16">
          {primary.map((it) => (
            <NavLink key={it.id} to={it.to} end={it.end} data-testid={`nav-${it.id}`} className={({ isActive }) => cn(tab, isActive && "text-primary")}>
              <it.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /><span className="max-w-full truncate">{it.id === "policies" && role === "customer" ? "Policies" : it.label}</span>
            </NavLink>
          ))}
          <button type="button" data-testid="nav-more" onClick={() => setMore(true)} aria-haspopup="dialog" className={cn(tab, moreActive && "text-primary")}>
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden /><span>More</span>
          </button>
        </div>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="pb-safe">
          <div className="border-b border-border px-5 py-4 pr-14">
            <SheetTitle>More</SheetTitle><SheetDescription className="truncate">{user?.name}</SheetDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <ul>
              {rest.map((it) => (
                <li key={it.id}>
                  <button type="button" data-testid={`nav-${it.id}`} onClick={act(() => nav(it.to))} className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text hover:bg-surface-muted">
                    <it.icon className="h-5 w-5 text-text-muted" strokeWidth={1.75} aria-hidden />{it.label}
                  </button>
                </li>
              ))}
              <li><button type="button" onClick={act(openSettings)} className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text hover:bg-surface-muted"><Settings className="h-5 w-5 text-text-muted" strokeWidth={1.75} aria-hidden />Settings</button></li>
              <li><button type="button" onClick={act(openHelp)} className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-text hover:bg-surface-muted"><HelpCircle className="h-5 w-5 text-text-muted" strokeWidth={1.75} aria-hidden />Help</button></li>
            </ul>
            <div className="mt-2 border-t border-border px-3 pt-4"><ThemeSwitcher className="[&_button]:h-10" /></div>
            <div className="mt-2 px-0 pt-2">
              <button type="button" data-testid="sign-out" onClick={act(async () => { await logout(); nav("/login", { replace: true }); })} className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger-bg">
                <LogOut className="h-5 w-5" strokeWidth={1.75} aria-hidden />Sign out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
