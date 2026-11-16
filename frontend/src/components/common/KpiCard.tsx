import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TILE = {
  primary: "bg-primary-soft text-primary", success: "bg-success-bg text-success", warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger", info: "bg-info-bg text-info", neutral: "bg-neutral-bg text-neutral",
} as const;

export function KpiCard({ label, value, hint, icon: Icon, loading, tone = "primary", className }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon: LucideIcon; loading?: boolean; tone?: keyof typeof TILE; className?: string;
}) {
  return (
    <Card className={cn("flex h-full items-start gap-3 p-4 sm:px-5", className)}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TILE[tone])}><Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text-muted">{label}</p>
        {loading ? <Skeleton className="mt-1 h-9 w-24" /> : <p className="truncate text-kpi tabular-nums text-text">{value}</p>}
        {loading ? <Skeleton className="mt-1 h-4 w-32" /> : <p className="truncate text-xs text-text-muted">{hint ?? " "}</p>}
      </div>
    </Card>
  );
}
