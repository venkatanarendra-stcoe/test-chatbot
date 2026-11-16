import { FileText, LayoutDashboard, ListChecks, Lock, Server, ShieldCheck, UserCircle, Users, Wallet, type LucideIcon } from "lucide-react";

export const BRAND = import.meta.env.VITE_BRAND_NAME || "Insurance Portal";

export interface NavItem { id: string; to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavGroup { title: string; items: NavItem[] }

export const CUSTOMER_NAV: NavGroup[] = [
  { title: "Overview", items: [{ id: "dashboard", to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  { title: "Insurance", items: [
    { id: "policies", to: "/policies", label: "My Policies", icon: ShieldCheck },
    { id: "claims", to: "/claims", label: "Claims", icon: FileText },
    { id: "payments", to: "/payments", label: "Payments", icon: Wallet },
  ] },
  { title: "Account", items: [{ id: "profile", to: "/profile", label: "Profile", icon: UserCircle }] },
];

export const ADMIN_NAV: NavGroup[] = [
  { title: "Overview", items: [{ id: "overview", to: "/admin", label: "Overview", icon: LayoutDashboard, end: true }] },
  { title: "Data", items: [
    { id: "customers", to: "/admin/customers", label: "Customers", icon: Users },
    { id: "policies", to: "/admin/policies", label: "Policies", icon: ShieldCheck },
    { id: "claims", to: "/admin/claims", label: "Claims", icon: FileText },
  ] },
  { title: "Security", items: [
    { id: "logs", to: "/admin/logs", label: "Agent Logs", icon: ListChecks },
    { id: "lockouts", to: "/admin/lockouts", label: "Lockouts", icon: Lock },
  ] },
  { title: "System", items: [{ id: "system", to: "/admin/system", label: "System", icon: Server }] },
];

export const MOBILE_PRIMARY: Record<"customer" | "admin", string[]> = {
  customer: ["dashboard", "policies", "claims", "payments"],
  admin: ["overview", "customers", "claims", "logs"],
};

export const navFor = (role: string | undefined) => (role === "admin" ? ADMIN_NAV : CUSTOMER_NAV);

/** Title for the mobile top bar, derived from the route. */
export function routeTitle(pathname: string, role: string | undefined): string {
  const items = navFor(role).flatMap((g) => g.items);
  const exact = items.find((i) => i.to === pathname);
  if (exact) return exact.label;
  if (pathname.startsWith("/policies/")) return "Policy";
  if (pathname.startsWith("/admin/customers/")) return "Customer";
  return BRAND;
}
