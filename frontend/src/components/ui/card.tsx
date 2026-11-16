import * as React from "react";
import { cn } from "@/lib/utils";

const make = (base: string, name: string) => {
  const C = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...p }, ref) => (
    <div ref={ref} className={cn(base, className)} {...p} />
  ));
  C.displayName = name;
  return C;
};
export const Card = make("rounded-xl border border-border bg-surface text-text shadow-xs", "Card");
export const CardHeader = make("flex items-start justify-between gap-3 p-4 pb-0 sm:p-5 sm:pb-0", "CardHeader");
export const CardTitle = make("text-section text-text", "CardTitle");
export const CardDescription = make("text-sm text-text-secondary", "CardDescription");
export const CardContent = make("p-4 sm:p-5", "CardContent");
