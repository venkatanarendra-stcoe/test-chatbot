import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, HelpCircle, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/useAuth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useShell } from "./shell";

/** User card for the sidebar footer. In collapsed mode only the avatar shows and the menu opens to the right. */
export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { openSettings, openHelp } = useShell();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me, enabled: user?.role === "customer" });
  if (!user) return null;
  const sub = user.role === "admin" ? "Administrator" : me?.profile?.customer_id ?? "Customer";

  const trigger = (
    <button type="button" data-testid="user-menu" aria-label={`User menu, ${user.name}`}
      className={cn("flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center")}>
      <Avatar className="h-8 w-8"><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium leading-5 text-text">{user.name}</span>
            <span className="block truncate text-xs leading-4 tabular-nums text-text-muted">{sub}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
        </>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed
        ? <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger></TooltipTrigger><TooltipContent side="right">{user.name}</TooltipContent></Tooltip>
        : <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>}
      <DropdownMenuContent side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} className="w-60">
        <DropdownMenuLabel>{user.name} · <span className="capitalize">{user.role}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "customer" && <DropdownMenuItem onSelect={() => nav("/profile")}><UserIcon /> Profile</DropdownMenuItem>}
        <DropdownMenuItem onSelect={openSettings}><Settings /> Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={openHelp}><HelpCircle /> Help</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="sign-out" onSelect={async () => { await logout(); nav("/login", { replace: true }); }}><LogOut /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
