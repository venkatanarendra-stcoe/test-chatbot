import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAlert } from "@/services/api";

/** Compact (44px) dismissible banners; multiple alerts stack. */
export function AlertsBanner({ alerts }: { alerts: DashboardAlert[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const shown = alerts.filter((a) => !hidden.includes(a.type + a.policy_number));
  if (!shown.length) return null;
  return (
    <div className="flex shrink-0 flex-col gap-2" role="region" aria-label="Important alerts">
      {shown.map((a) => {
        const warn = a.severity === "warning";
        const Icon = warn ? AlertTriangle : XCircle;
        const key = a.type + a.policy_number;
        return (
          <div key={key} role="alert" className={cn("flex min-h-11 items-center gap-3 rounded-lg border px-3 py-1.5 text-sm", warn ? "border-warning/30 bg-warning-bg text-warning" : "border-danger/30 bg-danger-bg text-danger")}>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1 font-medium">{a.message}</span>
            <Link to={`/policies/${a.policy_number}`} className="shrink-0 rounded font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View policy</Link>
            <button type="button" aria-label="Dismiss alert" onClick={() => setHidden((h) => [...h, key])} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
