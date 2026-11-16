import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/** Title block for the top of every page. Never scrolls away on list pages (it is a fixed sibling of the table card). */
export function PageHeader({ title, description, actions, badge, crumbs = true }: { crumbs?: boolean; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; badge?: React.ReactNode }) {
  const mobile = useIsMobile();
  return (
    <div className="flex shrink-0 flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {!mobile && crumbs && <Breadcrumbs />}
        <div className={cn("flex items-center gap-3", !mobile && crumbs && "mt-1")}>
          <h1 className="min-w-0 truncate text-title text-text">{title}</h1>{badge}
        </div>
        {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Page that is allowed to grow; the content pane scrolls only when the viewport is too small. */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex shrink-0 flex-col gap-4 pb-16 xl:gap-6", className)}>{children}</div>;
}

/** Page whose table card fills the remaining height. Only the table body scrolls. */
export function ListPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-h-[420px] flex-1 flex-col gap-4", className)}>{children}</div>;
}
