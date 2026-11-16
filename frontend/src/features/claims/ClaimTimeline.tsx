import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const HAPPY = ["Submitted", "Documents Pending", "Under Review", "Approved", "Settled"];
const REJECTED = ["Submitted", "Under Review", "Rejected"];

/** Submitted → Documents Pending → Under Review → Approved → Settled, or ... → Rejected. */
export function ClaimTimeline({ status }: { status: string }) {
  const steps = status === "Rejected" ? REJECTED : HAPPY;
  const current = Math.max(0, steps.indexOf(status));
  return (
    <ol aria-label="Claim progress">
      {steps.map((s, i) => {
        const done = i < current, active = i === current, bad = active && s === "Rejected";
        return (
          <li key={s} className="relative flex gap-3 pb-6 last:pb-0" aria-current={active ? "step" : undefined}>
            {i < steps.length - 1 && <span aria-hidden className={cn("absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5", done ? "bg-primary" : "bg-border")} />}
            <span className={cn("z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium tabular-nums",
              done && "border-primary bg-primary text-primary-foreground", active && !bad && "border-primary bg-surface text-primary ring-4 ring-primary-soft",
              bad && "border-danger bg-danger text-surface", !done && !active && "border-border bg-surface text-text-muted")}>
              {bad ? <X className="h-4 w-4" /> : done || (active && (s === "Settled" || s === "Approved")) ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <div className="pt-0.5"><p className={cn("text-sm", active ? "font-medium text-text" : done ? "text-text" : "text-text-muted")}>{s}</p>{active && <p className="text-xs text-text-muted">Current status</p>}</div>
          </li>
        );
      })}
    </ol>
  );
}
