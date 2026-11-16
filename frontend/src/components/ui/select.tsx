import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Styled native select (accessible, keyboard friendly, works inside sheets/dialogs). */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }>(({ className, wrapperClassName, children, ...props }, ref) => (
  <div className={cn("relative inline-block", wrapperClassName)}>
    <select ref={ref} className={cn("h-9 w-full appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 text-sm text-text shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", className)} {...props}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
  </div>
));
Select.displayName = "Select";
