import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { navFor } from "./nav";

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const items = navFor(user?.role).flatMap((g) => g.items);
  const admin = user?.role === "admin";
  const home = admin ? { to: "/admin", label: "Admin" } : { to: "/", label: "Home" };

  const trail: { to: string; label: string; mono?: boolean }[] = [];
  const hit = items.find((i) => i.to === pathname);
  if (hit && hit.to !== home.to) trail.push({ to: hit.to, label: hit.label });
  else if (!hit) {
    const parent = items.filter((i) => i.to !== home.to && pathname.startsWith(i.to + "/")).sort((a, b) => b.to.length - a.to.length)[0];
    if (parent) trail.push({ to: parent.to, label: parent.label });
    trail.push({ to: pathname, label: decodeURIComponent(pathname.split("/").pop() ?? ""), mono: true });
  }
  const dashboard = pathname === "/" || pathname === "/admin";

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-xs">
      <ol className="flex items-center gap-1 text-text-muted">
        {dashboard ? <li aria-current="page" className="font-medium text-text-secondary">{admin ? "Admin / Overview" : "Dashboard"}</li> : (
          <>
            <li><Link to={home.to} className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{home.label}</Link></li>
            {trail.map((c, i) => (
              <Fragment key={c.to}>
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                <li className="min-w-0 truncate">
                  {i === trail.length - 1
                    ? <span aria-current="page" className={"font-medium text-text-secondary tabular-nums"}>{c.label}</span>
                    : <Link to={c.to} className="rounded hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{c.label}</Link>}
                </li>
              </Fragment>
            ))}
          </>
        )}
      </ol>
    </nav>
  );
}
