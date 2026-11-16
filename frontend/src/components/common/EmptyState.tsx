import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fills its container (card or table scroll area) instead of collapsing. */
export function EmptyState({ icon: Icon = Inbox, title, message, action, className }: { icon?: LucideIcon; title: string; message?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted"><Icon className="h-5 w-5 text-text-muted" strokeWidth={1.75} aria-hidden /></div>
      <p className="text-sm font-medium text-text">{title}</p>
      {message && <p className="max-w-sm text-sm text-text-secondary">{message}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
