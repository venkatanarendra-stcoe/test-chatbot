import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option<T extends string> { value: T; label: string; icon?: LucideIcon }

/** Compact segmented control (radio group semantics). */
export function Segmented<T extends string>({ value, onChange, options, label, className, hideLabels }: {
  value: T; onChange: (v: T) => void; options: Option<T>[]; label: string; className?: string; hideLabels?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-surface-muted p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} aria-label={o.label} onClick={() => onChange(o.value)}
            className={cn("inline-flex h-8 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-surface text-text shadow-xs" : "text-text-muted hover:text-text")}>
            {o.icon && <o.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
            {!hideLabels && <span className="truncate">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
